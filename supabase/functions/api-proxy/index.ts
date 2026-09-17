import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://velamigo.github.io',
  'https://pmsystem-cc.velamigo.workers.dev',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  // Only echo the Origin back when it is explicitly whitelisted; otherwise the
  // browser blocks the response because no Allow-Origin header is present.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

// ---- Rate limiting (per IP, stored in DB so it works across isolates) ----
async function rateLimited(
  supabase: ReturnType<typeof createClient>,
  ip: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now()
  const { data } = await supabase
    .from('auth_rate_limits')
    .select('count, reset_at')
    .eq('ip', ip)
    .maybeSingle()

  if (!data || new Date(data.reset_at).getTime() < now) {
    await supabase
      .from('auth_rate_limits')
      .upsert({ ip, count: 1, reset_at: new Date(now + windowMs).toISOString() })
    return false
  }
  if (data.count >= limit) return true
  await supabase.from('auth_rate_limits').update({ count: data.count + 1 }).eq('ip', ip)
  return false
}

// Generate random salt
function generateSalt(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Hash password with salt
async function hashPassword(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || generateSalt()
  const encoder = new TextEncoder()
  const data = encoder.encode(actualSalt + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `${actualSalt}:${hash}`
}

// Verify password
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':')
  if (parts.length !== 2) return false
  const [salt] = parts
  const newHash = await hashPassword(password, salt)
  return newHash === storedHash
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { operation, params, authToken } = await req.json()

    const clientIp = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()

    // Rate limit auth-related public ops
    if (['login', 'register', 'initAdmin'].includes(operation)) {
      if (await rateLimited(supabase, clientIp, 20, 60_000)) {
        return json({ error: 'Too many requests, slow down' }, 429)
      }
    }

    const publicOps = ['login', 'register', 'initAdmin']
    const isPublic = publicOps.includes(operation)

    let userId: string | null = null
    let userRole: string | null = null

    if (!isPublic) {
      if (!authToken) {
        return json({ error: 'Not authenticated' }, 401)
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, role, status')
        .eq('id', authToken)
        .single()

      if (userError || !user || user.status !== 'approved') {
        return json({ error: 'Not authenticated' }, 401)
      }

      userId = user.id
      userRole = user.role
    }

    const adminOps = ['getPendingUsers', 'getAllUsers', 'approveUser', 'rejectUser', 'deleteUser', 'resetUserPassword', 'changeUsername']
    if (adminOps.includes(operation) && userRole !== 'admin') {
      return json({ error: 'Admin access required' }, 403)
    }

    // Visibility model: a PERSONAL project belongs to its creator only, a TEAM
    // project is visible to every logged-in user. Reading and editing the tasks
    // inside a TEAM project is open to all; project-level mutations (rename,
    // status, visibility, delete) stay owner-only.
    const TEAM_VISIBILITY = 'TEAM'

    async function getVisibleProjectIds(): Promise<string[]> {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .or(`user_id.eq.${userId},visibility.eq.${TEAM_VISIBILITY}`)
      if (error) throw error
      return (data || []).map((r: any) => r.id)
    }

    // Returns true when the caller may touch the project. A missing row means the
    // project is being created right now, so the caller becomes its owner.
    async function canAccessProject(projectId: string, requireOwner = false): Promise<boolean> {
      const { data, error } = await supabase
        .from('projects')
        .select('user_id, visibility')
        .eq('id', projectId)
        .maybeSingle()
      if (error) throw error
      if (!data) return true
      if (data.user_id === userId) return true
      return !requireOwner && data.visibility === TEAM_VISIBILITY
    }

    // Keeps the original creator when a teammate edits a shared row.
    async function rowOwner(table: string, id: string): Promise<string | undefined> {
      if (!id) return undefined
      const { data } = await supabase.from(table).select('user_id').eq('id', id).maybeSingle()
      return data?.user_id ?? undefined
    }

    let result

    switch (operation) {
      case 'login': {
        const { data: loginData } = await supabase
          .from('users')
          .select('id, name, role, status, password_hash, created_at')
          .eq('name', params.name)
          .single()
        if (!loginData) {
          result = null
          break
        }
        const valid = await verifyPassword(params.password, loginData.password_hash)
        if (!valid) {
          result = null
          break
        }
        const { password_hash, ...safeUser } = loginData
        result = safeUser
        break
      }

      case 'register': {
        const passwordHash = await hashPassword(params.password)
        const { data: regData, error: regError } = await supabase
          .from('users')
          .insert({
            name: params.name,
            password_hash: passwordHash,
            role: 'user',
            status: 'pending',
          })
          .select('id, name, role, status, created_at')
          .single()
        if (regError) throw regError
        result = regData
        break
      }

      case 'initAdmin': {
        const { data: existingAdmins } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .limit(1)
        if (existingAdmins && existingAdmins.length > 0) {
          result = { created: false }
          break
        }
        const adminPassword = Deno.env.get('ADMIN_INIT_PASSWORD')
        if (!adminPassword) {
          return json({ error: 'Admin init not configured' }, 403)
        }
        const adminHash = await hashPassword(adminPassword)
        const { data: adminData, error: adminError } = await supabase
          .from('users')
          .insert({
            name: 'superadmin',
            password_hash: adminHash,
            role: 'admin',
            status: 'approved',
          })
          .select('id, name, role, status, created_at')
          .single()
        if (adminError) throw adminError
        result = { created: true, admin: adminData }
        break
      }

      case 'getPendingUsers': {
        const { data: pendingData } = await supabase
          .from('users')
          .select('id, name, role, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        result = pendingData || []
        break
      }

      case 'getAllUsers': {
        const { data: allUsersData } = await supabase
          .from('users')
          .select('id, name, role, status, created_at')
          .order('created_at', { ascending: false })
        result = allUsersData || []
        break
      }

      case 'approveUser': {
        const { error } = await supabase.from('users').update({ status: 'approved' }).eq('id', params.userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'rejectUser': {
        const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', params.userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'deleteUser': {
        if (params.userId === userId) {
          return json({ error: '不能删除自己' }, 400)
        }
        const { data: targetUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', params.userId)
          .single()
        if (targetUser?.role === 'admin') {
          const { count } = await supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('role', 'admin')
          if (count && count <= 1) {
            return json({ error: '不能删除最后一个管理员' }, 400)
          }
        }
        const { error } = await supabase.from('users').delete().eq('id', params.userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'resetUserPassword': {
        const passwordHash = await hashPassword(params.password)
        const { error } = await supabase.from('users').update({ password_hash: passwordHash }).eq('id', params.userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'changeOwnPassword': {
        const { data: me } = await supabase
          .from('users')
          .select('password_hash')
          .eq('id', userId)
          .single()
        if (!me || !(await verifyPassword(params.oldPassword, me.password_hash))) {
          return json({ error: '原密码错误' }, 400)
        }
        const newHash = await hashPassword(params.newPassword)
        const { error } = await supabase.from('users').update({ password_hash: newHash }).eq('id', userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'changeUsername': {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('name', params.newName)
          .single()
        if (existingUser) {
          return json({ error: '用户名已存在' }, 400)
        }
        const { error } = await supabase.from('users').update({ name: params.newName }).eq('id', params.userId)
        if (error) throw error
        result = { success: true }
        break
      }

      // Projects
      case 'getProjects': {
        const visibleIds = await getVisibleProjectIds()
        if (visibleIds.length === 0) {
          result = []
          break
        }

        const { data: projectsData, error: projError } = await supabase
          .from('projects')
          .select('*')
          .in('id', visibleIds)
          .order('created_at', { ascending: true })
        if (projError) return json({ error: projError.message }, 500)

        // Soft-deleted projects are kept so the recycle bin still works, but only
        // for their owner: nobody else should restore or purge them.
        const readableProjects = (projectsData || []).filter(
          (p: any) => !p.deleted_at || p.user_id === userId
        )
        const readableIds = readableProjects.map((p: any) => p.id)
        if (readableIds.length === 0) {
          result = []
          break
        }

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .in('project_id', readableIds)

        const taskIds = (tasksData || []).map((t: any) => t.id)
        let subtasksData: any[] = []
        if (taskIds.length > 0) {
          const { data: subtaskRows } = await supabase
            .from('subtasks')
            .select('*')
            .in('task_id', taskIds)
          subtasksData = subtaskRows || []
        }

        const { data: milestonesData } = await supabase
          .from('milestones')
          .select('*')
          .in('project_id', readableIds)

        // Owner display names, so the UI can label which teammate a team project belongs to
        const ownerIds = Array.from(new Set(readableProjects.map((p: any) => p.user_id))).filter(Boolean)
        let ownerNameById: Record<string, string> = {}
        if (ownerIds.length > 0) {
          const { data: ownerRows } = await supabase
            .from('users')
            .select('id, name')
            .in('id', ownerIds as string[])
          ownerNameById = Object.fromEntries((ownerRows || []).map((u: any) => [u.id, u.name]))
        }

        // Assemble nested camelCase project objects expected by the frontend
        result = readableProjects.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? '',
          status: p.status,
          visibility: p.visibility || 'PERSONAL',
          ownerId: p.user_id,
          ownerName: ownerNameById[p.user_id],
          deletedAt: p.deleted_at,
          createdAt: p.created_at,
          tasks: (tasksData || [])
            .filter((t: any) => t.project_id === p.id)
            .map((t: any) => ({
              id: t.id,
              projectId: t.project_id,
              title: t.title,
              description: t.description ?? '',
              status: t.status,
              priority: t.priority,
              tags: t.tags || [],
              startDate: t.start_date,
              dueDate: t.due_date,
              assignee: t.assignee ?? '',
              requester: t.requester ?? '',
              dependencies: t.dependencies || [],
              createdAt: t.created_at,
              subtasks: (subtasksData || [])
                .filter((st: any) => st.task_id === t.id)
                .map((st: any) => ({
                  id: st.id,
                  title: st.title,
                  completed: !!st.completed,
                  assignee: st.assignee ?? '',
                  dueDate: st.due_date,
                })),
            })),
          milestones: (milestonesData || [])
            .filter((m: any) => m.project_id === p.id)
            .map((m: any) => ({
              id: m.id,
              title: m.title,
              date: m.date,
              completed: !!m.completed,
            })),
        }))
        break
      }

      case 'saveProject': {
        // Project-level writes stay owner-only, even for TEAM projects.
        if (!(await canAccessProject(params.project.id, true))) {
          return json({ error: 'Forbidden' }, 403)
        }
        // Only touch visibility when the client explicitly sent it, so importing
        // an older backup cannot silently downgrade a TEAM project.
        const visibility =
          params.project.visibility === TEAM_VISIBILITY
            ? TEAM_VISIBILITY
            : params.project.visibility === 'PERSONAL'
            ? 'PERSONAL'
            : undefined
        const { data: projectData, error } = await supabase
          .from('projects')
          .upsert({
            id: params.project.id,
            user_id: userId,
            name: params.project.name,
            description: params.project.description,
            status: params.project.status,
            deleted_at: params.project.deletedAt,
            created_at: params.project.createdAt,
            ...(visibility ? { visibility } : {}),
          })
          .select()
          .single()
        if (error) throw error

        // Sync the whole project aggregate: tasks + subtasks + milestones
        const projectId = params.project.id
        const tasks = Array.isArray(params.project.tasks) ? params.project.tasks : []
        const milestones = Array.isArray(params.project.milestones) ? params.project.milestones : []

        for (const task of tasks) {
          const { error: taskError } = await supabase
            .from('tasks')
            .upsert({
              id: task.id,
              project_id: projectId,
              user_id: userId,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              tags: task.tags || [],
              start_date: task.startDate,
              due_date: task.dueDate,
              assignee: task.assignee,
              requester: task.requester,
              dependencies: task.dependencies || [],
              created_at: task.createdAt,
            })
          if (taskError) throw taskError

          const subtasks = Array.isArray(task.subtasks) ? task.subtasks : []
          for (const subtask of subtasks) {
            const { error: subtaskError } = await supabase
              .from('subtasks')
              .upsert({
                id: subtask.id,
                task_id: task.id,
                user_id: userId,
                title: subtask.title,
                completed: !!subtask.completed,
                assignee: subtask.assignee || '',
                due_date: subtask.dueDate || null,
              })
            if (subtaskError) throw subtaskError
          }
          const subtaskIds = subtasks.map((s: any) => s.id)
          const { error: subtaskDeleteError } = subtaskIds.length
            ? await supabase.from('subtasks').delete().eq('task_id', task.id).not('id', 'in', `(${subtaskIds.join(',')})`)
            : await supabase.from('subtasks').delete().eq('task_id', task.id)
          if (subtaskDeleteError) throw subtaskDeleteError
        }

        const taskIds = tasks.map((t: any) => t.id)
        const { error: taskDeleteError } = taskIds.length
          ? await supabase.from('tasks').delete().eq('project_id', projectId).not('id', 'in', `(${taskIds.join(',')})`)
          : await supabase.from('tasks').delete().eq('project_id', projectId)
        if (taskDeleteError) throw taskDeleteError

        for (const milestone of milestones) {
          const { error: milestoneError } = await supabase
            .from('milestones')
            .upsert({
              id: milestone.id,
              project_id: projectId,
              user_id: userId,
              title: milestone.title,
              date: milestone.date,
              completed: !!milestone.completed,
            })
          if (milestoneError) throw milestoneError
        }
        const milestoneIds = milestones.map((m: any) => m.id)
        const { error: milestoneDeleteError } = milestoneIds.length
          ? await supabase.from('milestones').delete().eq('project_id', projectId).not('id', 'in', `(${milestoneIds.join(',')})`)
          : await supabase.from('milestones').delete().eq('project_id', projectId)
        if (milestoneDeleteError) throw milestoneDeleteError

        result = projectData
        break
      }

      case 'deleteProject': {
        if (!(await canAccessProject(params.projectId, true))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString(), status: 'TRASHED' }).eq('id', params.projectId).eq('user_id', userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'hardDeleteProject': {
        if (!(await canAccessProject(params.projectId, true))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { error } = await supabase.from('projects').delete().eq('id', params.projectId).eq('user_id', userId)
        if (error) throw error
        result = { success: true }
        break
      }

      // Tasks
      case 'getTasks': {
        const visibleIds = await getVisibleProjectIds()
        if (visibleIds.length === 0) {
          result = []
          break
        }
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .in('project_id', visibleIds)
          .order('created_at', { ascending: false })
        result = tasksData || []
        break
      }

      case 'saveTask': {
        const taskProjectId = params.task.projectId || params.task.project_id
        if (!params.task.id) return json({ error: 'Task id required' }, 400)
        if (!taskProjectId) return json({ error: 'projectId required' }, 400)
        // Anyone may edit tasks inside a TEAM project; PERSONAL stays owner-only.
        if (!(await canAccessProject(taskProjectId, false))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { data: taskData, error } = await supabase
          .from('tasks')
          .upsert({
            id: params.task.id,
            project_id: taskProjectId,
            user_id: (await rowOwner('tasks', params.task.id)) || userId,
            title: params.task.title,
            description: params.task.description,
            status: params.task.status,
            priority: params.task.priority,
            tags: params.task.tags || [],
            start_date: params.task.startDate,
            due_date: params.task.dueDate,
            assignee: params.task.assignee,
            requester: params.task.requester,
            dependencies: params.task.dependencies || [],
            created_at: params.task.createdAt,
          })
          .select()
          .single()
        if (error) throw error

        // Persist the checklist too, so a single saveTask writes the whole task.
        const taskSubtasks = Array.isArray(params.task.subtasks) ? params.task.subtasks : []
        for (const subtask of taskSubtasks) {
          if (!subtask.id) continue
          const { error: subtaskError } = await supabase
            .from('subtasks')
            .upsert({
              id: subtask.id,
              task_id: params.task.id,
              user_id: (await rowOwner('subtasks', subtask.id)) || userId,
              title: subtask.title || '',
              completed: !!subtask.completed,
              assignee: subtask.assignee || '',
              due_date: subtask.dueDate || subtask.due_date || null,
            })
          if (subtaskError) throw subtaskError
        }
        const keepSubtaskIds = taskSubtasks.filter((s: any) => s.id).map((s: any) => s.id)
        const cleanup =
          keepSubtaskIds.length > 0
            ? await supabase.from('subtasks').delete().eq('task_id', params.task.id).not('id', 'in', `(${keepSubtaskIds.join(',')})`)
            : await supabase.from('subtasks').delete().eq('task_id', params.task.id)
        if (cleanup.error) throw cleanup.error

        result = taskData
        break
      }

      case 'deleteTask': {
        const { data: taskRow } = await supabase.from('tasks').select('project_id').eq('id', params.taskId).maybeSingle()
        if (taskRow && !(await canAccessProject(taskRow.project_id, false))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { error } = await supabase.from('tasks').delete().eq('id', params.taskId)
        if (error) throw error
        result = { success: true }
        break
      }

      // Milestones
      case 'getMilestones': {
        const visibleIds = await getVisibleProjectIds()
        if (visibleIds.length === 0) {
          result = []
          break
        }
        const { data: milestonesData } = await supabase
          .from('milestones')
          .select('*')
          .in('project_id', visibleIds)
          .order('created_at', { ascending: false })
        result = milestonesData || []
        break
      }

      case 'saveMilestone': {
        const milestoneProjectId = params.milestone.projectId || params.milestone.project_id
        if (!params.milestone.id) return json({ error: 'Milestone id required' }, 400)
        if (!milestoneProjectId) return json({ error: 'projectId required' }, 400)
        if (!(await canAccessProject(milestoneProjectId, false))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { data: milestoneData, error } = await supabase
          .from('milestones')
          .upsert({
            id: params.milestone.id,
            project_id: milestoneProjectId,
            user_id: (await rowOwner('milestones', params.milestone.id)) || userId,
            title: params.milestone.title,
            date: params.milestone.date,
            completed: !!params.milestone.completed,
          })
          .select()
          .single()
        if (error) throw error
        result = milestoneData
        break
      }

      case 'deleteMilestone': {
        const { data: milestoneRow } = await supabase.from('milestones').select('project_id').eq('id', params.milestoneId).maybeSingle()
        if (milestoneRow && !(await canAccessProject(milestoneRow.project_id, false))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { error } = await supabase.from('milestones').delete().eq('id', params.milestoneId)
        if (error) throw error
        result = { success: true }
        break
      }

      // Subtasks
      case 'getSubtasks': {
        const visibleIds = await getVisibleProjectIds()
        if (visibleIds.length === 0) {
          result = []
          break
        }
        const { data: visibleTasks } = await supabase.from('tasks').select('id').in('project_id', visibleIds)
        const visibleTaskIds = (visibleTasks || []).map((t: any) => t.id)
        if (visibleTaskIds.length === 0) {
          result = []
          break
        }
        const { data: subtasksData } = await supabase
          .from('subtasks')
          .select('*')
          .in('task_id', visibleTaskIds)
          .order('created_at', { ascending: false })
        result = subtasksData || []
        break
      }

      case 'saveSubtask': {
        const subtaskTaskId = params.subtask.taskId || params.subtask.task_id
        if (!params.subtask.id) return json({ error: 'Subtask id required' }, 400)
        if (!subtaskTaskId) return json({ error: 'taskId required' }, 400)
        const { data: parentTask } = await supabase.from('tasks').select('project_id').eq('id', subtaskTaskId).maybeSingle()
        if (!parentTask) return json({ error: 'Parent task not found' }, 404)
        if (!(await canAccessProject(parentTask.project_id, false))) {
          return json({ error: 'Forbidden' }, 403)
        }
        const { data: subtaskData, error } = await supabase
          .from('subtasks')
          .upsert({
            id: params.subtask.id,
            task_id: subtaskTaskId,
            user_id: (await rowOwner('subtasks', params.subtask.id)) || userId,
            title: params.subtask.title,
            completed: !!params.subtask.completed,
            assignee: params.subtask.assignee || '',
            due_date: params.subtask.dueDate || null,
          })
          .select()
          .single()
        if (error) throw error
        result = subtaskData
        break
      }

      case 'deleteSubtask': {
        const { data: subtaskRow } = await supabase.from('subtasks').select('task_id').eq('id', params.subtaskId).maybeSingle()
        if (subtaskRow) {
          const { data: parentTask } = await supabase.from('tasks').select('project_id').eq('id', subtaskRow.task_id).maybeSingle()
          if (parentTask && !(await canAccessProject(parentTask.project_id, false))) {
            return json({ error: 'Forbidden' }, 403)
          }
        }
        const { error } = await supabase.from('subtasks').delete().eq('id', params.subtaskId)
        if (error) throw error
        result = { success: true }
        break
      }

      // Notifications
      case 'getNotifications': {
        const { data: notificationsData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = notificationsData || []
        break
      }

      case 'addNotification': {
        const { data: notificationData, error } = await supabase
          .from('notifications')
          .insert({
            id: params.notification.id,
            user_id: userId,
            type: params.notification.type,
            title: params.notification.title,
            message: params.notification.message,
            read: params.notification.read,
            related_id: params.notification.relatedId,
            created_at: params.notification.createdAt,
          })
          .select()
          .single()
        if (error) throw error
        result = notificationData
        break
      }

      case 'markNotificationRead': {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', params.notificationId).eq('user_id', userId)
        if (error) throw error
        result = { success: true }
        break
      }

      // Settings
      case 'getSettings': {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'app_settings')
          .eq('user_id', userId)
          .single()
        result = settingsData?.value || {
          commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
          commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
          commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
          enableAutoExcelExport: false,
        }
        break
      }

      case 'saveSettings': {
        const { error } = await supabase
          .from('settings')
          .upsert(
            {
              key: 'app_settings',
              user_id: userId,
              value: params.settings,
            },
            { onConflict: 'key,user_id' }
          )
        if (error) throw error
        result = { success: true }
        break
      }

      default:
        return json({ error: 'Unknown operation' }, 400)
    }

    return json({ data: result })
  } catch (error) {
    return json({ error: 'Internal error' }, 500)
  }
})
