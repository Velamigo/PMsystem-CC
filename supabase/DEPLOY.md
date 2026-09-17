# 部署 Edge Function 到 Supabase

## 方法一：通过 Supabase Dashboard（推荐）

1. 打开 https://app.supabase.com/project/bqhnrmcrcvsmrxyxdymx/functions
2. 点击 **"New Function"**
3. 填写：
   - **Name**: `api-proxy`
   - 其他保持默认
4. 点击 **"Create"**
5. 在代码编辑器中，**删除所有现有代码**
6. **复制 `index.ts` 文件的全部内容** 粘贴进去
7. 点击 **"Deploy"**

## 方法二：通过 Supabase CLI（如果已安装）

```bash
# 登录
supabase login

# 链接项目
supabase link --project-ref bqhnrmcrcvsmrxyxdymx

# 设置环境变量（service role key）
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

# 部署函数
supabase functions deploy api-proxy
```

## 获取 Service Role Key

1. 打开 https://app.supabase.com/project/bqhnrmcrcvsmrxyxdymx/settings/api
2. 找到 **"Service Role Key"**（点击 "Reveal" 显示）
3. 复制这个 key

## 部署后测试

部署完成后，Edge Function 的 URL 将是：
```
https://bqhnrmcrcvsmrxyxdymx.supabase.co/functions/v1/api-proxy
```
