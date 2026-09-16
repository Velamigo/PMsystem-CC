import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://velamigo.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { operation, params, authToken } = await req.json()

    const publicOps = ['login', 'register', 'initAdmin']
    const isPublic = publicOps.includes(operation)

    let userId: string | null = null
    let userRole: string | null = null

    if (!isPublic) {
      if (!authToken) {
        return new Response(
          JSON.stringify({ error: 'Not authenticated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, role, status')
        .eq('id', authToken)
        .single()

      if (userError || !user || user.status !== 'approved') {
        return new Response(
          JSON.stringify({ error: 'Not authenticated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      userId = user.id
      userRole = user.role
    }

    const adminOps = ['getPendingUsers', 'getAllUsers', 'approveUser', 'rejectUser', 'deleteUser', 'resetUserPassword', 'changeUsername']
    if (adminOps.includes(operation) && userRole !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
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
        const adminPassword = Deno.env.get('ADMIN_INIT_PASSWORD') ?? 'ProTrack2024!'
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

      case 'approveUser':
        await supabase.from('users').update({ status: 'approved' }).eq('id', params.userId)
        result = { success: true }
        break

      case 'rejectUser':
        await supabase.from('users').update({ status: 'rejected' }).eq('id', params.userId)
        result = { success: true }
        break

      case 'deleteUser': {
        if (params.userId === userId) {
          return new Response(
            JSON.stringify({ error: '不能删除自己' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
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
            return new Response(
              JSON.stringify({ error: '不能删除最后一个管理员' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }
        }
        await supabase.from('users').delete().eq('id', params.userId)
        result = { success: true }
        break
      }

      case 'resetUserPassword': {
        const passwordHash = await hashPassword(params.password)
        await supabase.from('users').update({ password_hash: passwordHash }).eq('id', params.userId)
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
          return new Response(
            JSON.stringify({ error: '用户名已存在' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        await supabase.from('users').update({ name: params.newName }).eq('id', params.userId)
        result = { success: true }
        break
      }

      // Projects
      case 'getProjects': {
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = projectsData || []
        break
      }

      case 'saveProject': {
        const { data: projectData } = await supabase
          .from('projects')
          .upsert({
            id: params.project.id,
            user_id: userId,
            name: params.project.name,
            description: params.project.description,
            status: params.project.status,
            deleted_at: params.project.deletedAt,
            created_at: params.project.createdAt,
          })
          .select()
          .single()
        result = projectData
        break
      }

      case 'deleteProject':
        await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', params.projectId).eq('user_id', userId)
        result = { success: true }
        break

      case 'hardDeleteProject':
        await supabase.from('projects').delete().eq('id', params.projectId).eq('user_id', userId)
        result = { success: true }
        break

      // Tasks
      case 'getTasks': {
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = tasksData || []
        break
      }

      case 'saveTask': {
        const { data: taskData } = await supabase
          .from('tasks')
          .upsert({
            id: params.task.id,
            project_id: params.task.projectId,
            user_id: userId,
            title: params.task.title,
            description: params.task.description,
            status: params.task.status,
            priority: params.task.priority,
            tags: params.task.tags,
            start_date: params.task.startDate,
            due_date: params.task.dueDate,
            assignee: params.task.assignee,
            requester: params.task.requester,
            parent_task_id: params.task.parentTaskId,
            dependency_ids: params.task.dependencyIds,
            estimated_hours: params.task.estimatedHours,
            actual_hours: params.task.actualHours,
            completion_percentage: params.task.completionPercentage,
            created_at: params.task.createdAt,
          })
          .select()
          .single()
        result = taskData
        break
      }

      case 'deleteTask':
        await supabase.from('tasks').delete().eq('id', params.taskId).eq('user_id', userId)
        result = { success: true }
        break

      // Milestones
      case 'getMilestones': {
        const { data: milestonesData } = await supabase
          .from('milestones')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = milestonesData || []
        break
      }

      case 'saveMilestone': {
        const { data: milestoneData } = await supabase
          .from('milestones')
          .upsert({
            id: params.milestone.id,
            project_id: params.milestone.projectId,
            user_id: userId,
            title: params.milestone.title,
            description: params.milestone.description,
            due_date: params.milestone.dueDate,
            status: params.milestone.status,
            created_at: params.milestone.createdAt,
          })
          .select()
          .single()
        result = milestoneData
        break
      }

      case 'deleteMilestone':
        await supabase.from('milestones').delete().eq('id', params.milestoneId).eq('user_id', userId)
        result = { success: true }
        break

      // Subtasks
      case 'getSubtasks': {
        const { data: subtasksData } = await supabase
          .from('subtasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = subtasksData || []
        break
      }

      case 'saveSubtask': {
        const { data: subtaskData } = await supabase
          .from('subtasks')
          .upsert({
            id: params.subtask.id,
            task_id: params.subtask.taskId,
            user_id: userId,
            title: params.subtask.title,
            description: params.subtask.description,
            status: params.subtask.status,
            assignee: params.subtask.assignee,
            due_date: params.subtask.dueDate,
            created_at: params.subtask.createdAt,
          })
          .select()
          .single()
        result = subtaskData
        break
      }

      case 'deleteSubtask':
        await supabase.from('subtasks').delete().eq('id', params.subtaskId).eq('user_id', userId)
        result = { success: true }
        break

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
        const { data: notificationData } = await supabase
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
        result = notificationData
        break
      }

      case 'markNotificationRead':
        await supabase.from('notifications').update({ read: true }).eq('id', params.notificationId).eq('user_id', userId)
        result = { success: true }
        break

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

      case 'saveSettings':
        await supabase
          .from('settings')
          .upsert({
            key: 'app_settings',
            user_id: userId,
            value: params.settings,
          })
        result = { success: true }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown operation' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
