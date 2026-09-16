import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('DB_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const { operation, params, authToken } = await req.json()

    // Verify auth token
    if (!authToken) {
      return new Response(
        JSON.stringify({ error: 'Missing auth token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify user exists and is approved
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, role, status')
      .eq('id', authToken)
      .single()

    if (userError || !user || user.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Invalid or unauthorized user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const userId = user.id
    let result

    switch (operation) {
      // Users
      case 'login':
        const { data: loginData } = await supabase
          .from('users')
          .select('*')
          .eq('name', params.name)
          .single()
        result = loginData
        break

      case 'register':
        const { data: regData, error: regError } = await supabase
          .from('users')
          .insert({
            name: params.name,
            password_hash: params.passwordHash,
            role: 'user',
            status: 'pending',
          })
          .select()
          .single()
        if (regError) throw regError
        result = regData
        break

      case 'getPendingUsers':
        const { data: pendingData } = await supabase
          .from('users')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        result = pendingData || []
        break

      case 'getAllUsers':
        const { data: allUsersData } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })
        result = allUsersData || []
        break

      case 'approveUser':
        await supabase.from('users').update({ status: 'approved' }).eq('id', params.userId)
        result = { success: true }
        break

      case 'rejectUser':
        await supabase.from('users').update({ status: 'rejected' }).eq('id', params.userId)
        result = { success: true }
        break

      case 'deleteUser':
        await supabase.from('users').delete().eq('id', params.userId)
        result = { success: true }
        break

      case 'resetUserPassword':
        await supabase.from('users').update({ password_hash: params.passwordHash }).eq('id', params.userId)
        result = { success: true }
        break

      case 'changeUsername':
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

      // Projects
      case 'getProjects':
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = projectsData || []
        break

      case 'saveProject':
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

      case 'deleteProject':
        await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', params.projectId).eq('user_id', userId)
        result = { success: true }
        break

      case 'hardDeleteProject':
        await supabase.from('projects').delete().eq('id', params.projectId).eq('user_id', userId)
        result = { success: true }
        break

      // Tasks
      case 'getTasks':
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = tasksData || []
        break

      case 'saveTask':
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

      case 'deleteTask':
        await supabase.from('tasks').delete().eq('id', params.taskId).eq('user_id', userId)
        result = { success: true }
        break

      // Milestones
      case 'getMilestones':
        const { data: milestonesData } = await supabase
          .from('milestones')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = milestonesData || []
        break

      case 'saveMilestone':
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

      case 'deleteMilestone':
        await supabase.from('milestones').delete().eq('id', params.milestoneId).eq('user_id', userId)
        result = { success: true }
        break

      // Subtasks
      case 'getSubtasks':
        const { data: subtasksData } = await supabase
          .from('subtasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = subtasksData || []
        break

      case 'saveSubtask':
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

      case 'deleteSubtask':
        await supabase.from('subtasks').delete().eq('id', params.subtaskId).eq('user_id', userId)
        result = { success: true }
        break

      // Notifications
      case 'getNotifications':
        const { data: notificationsData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        result = notificationsData || []
        break

      case 'addNotification':
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

      case 'markNotificationRead':
        await supabase.from('notifications').update({ read: true }).eq('id', params.notificationId).eq('user_id', userId)
        result = { success: true }
        break

      // Settings
      case 'getSettings':
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
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
