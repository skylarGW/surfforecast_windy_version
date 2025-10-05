// Vercel Function: Windy API代理
export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 从环境变量获取API密钥，如果没有则使用默认值
    const apiKey = process.env.WINDY_API_KEY || 'gE7AqAGKM8h6TcgHDoseU8HmmddSqQka';
    
    // 构建请求体
    const requestBody = {
      ...req.body,
      key: apiKey
    };

    console.log('Calling Windy API with:', JSON.stringify(requestBody, null, 2));

    // 调用Windy API
    const response = await fetch('https://api.windy.com/api/point-forecast/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Windy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Windy API response received');

    // 返回数据
    res.status(200).json(data);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}