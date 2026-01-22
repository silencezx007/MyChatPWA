export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 配置您的 Supabase 项目域名
    // 建议通过环境变量 SUPABASE_URL 设置，或者直接硬编码在这里
    // 如果没有设置环境变量，请将 "您的项目ID.supabase.co" 替换为 "rdyqfbtgttjbqxhinxnm.supabase.co"
    const SUPABASE_URL = env.SUPABASE_URL || "rdyqfbtgttjbqxhinxnm.supabase.co";

    // 替换目标 Host
    url.hostname = SUPABASE_URL; // 注意：new URL().host 包含端口，hostname 不包含。Supabase URL 通常不需要端口。
    // 用户代码示例用了 url.host = SUPABASE_URL，如果 SUPABASE_URL 不带端口也行。
    // 为了稳妥，我们确保协议是 https
    url.protocol = "https:";

    // 2. 处理预检请求 (CORS)
    if (request.method === "OPTIONS") {
      // 获取请求中的 Access-Control-Request-Headers 并原样返回
      const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "*";
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": requestHeaders,
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 3. 转发请求
    // 重新构建 Request 对象，避免 immutable headers 问题
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    try {
      const response = await fetch(modifiedRequest);

      // 4. 构造响应并注入 CORS 头
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

      return newResponse;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Proxy Error", message: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  },
};
