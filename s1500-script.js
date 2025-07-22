const API_KEY = 'sk-111a4f87af724cd4b3a9c3e6bc8f85ab';
const BASE_URL = 'https://api.deepseek.com';

// S7-1500 SCL编程模板
const S1500_SCL_TEMPLATE = `
用西门子SCL语言写程序：

要求：
1.所有的变量都用中文表
2.请严格按照西门子SCL标准语法，CASE分支不使用BEGIN...END
3.所有TON定时器调用都必须包含IN和PT两个参数 
4.即使是复位定时器，也必须传递PT参数，不能省略 
5.时间格式使用T#数值单位的格式，如T#2S（2秒）、T#3S（3秒）
6.开头变量要有：Input,Output,Static变量，变量VAR Static的名称写成VAR
`;

let conversationHistory = [
    {
        role: "system",
        content: "你是一个专业的西门子S7-1500 PLC编程专家助手，专精于高级SCL（Structured Control Language）结构化控制语言编程。你精通S7-1500系列PLC的所有高级编程功能、复杂数据类型、面向对象编程、高性能指令集、工业以太网通信、安全功能、诊断功能等。你必须严格遵循西门子SCL标准语法规范，特别注意：1.使用中文变量名 2.CASE分支不使用BEGIN...END 3.TON定时器必须包含IN和PT参数 4.时间格式使用T#数值单位格式 5.正确声明Input、Output、Static变量区域。你还擅长大型项目架构设计和程序优化。请用中文回答，提供专业、准确、符合西门子SCL标准的高级编程解决方案。"
    }
];

let responseTimer = null;
let startTime = null;

function goBack() {
    window.location.href = 'index.html';
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const sendButton = document.getElementById('sendButton');
    const loading = document.getElementById('loading');
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // 添加用户消息到界面
    addMessageToChat('user', message);
    
    // 检查是否询问AI模型相关问题，如果是则直接回答
    if (isAIModelQuestion(message)) {
        userInput.value = '';
        const localResponse = "我是一个专门为解决PLC编程问题而研发的AI编程工具。";
        addMessageToChat('assistant', localResponse);
        return;
    }
    
    // 将用户消息和SCL编程要求模板一起添加到对话历史
    const messageWithTemplate = message + "\n\n" + S1500_SCL_TEMPLATE;
    conversationHistory.push({
        role: "user",
        content: messageWithTemplate
    });
    
    // 清空输入框并禁用发送按钮
    userInput.value = '';
    sendButton.disabled = true;
    
    // 立即创建AI消息框并开始计时
    const assistantMessageElement = createAssistantMessage();
    startResponseTimer();
    
    try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: conversationHistory,
                stream: true,
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await handleStreamResponse(response, assistantMessageElement);
        
    } catch (error) {
        console.error('Error:', error);
        updateAssistantMessage(assistantMessageElement, '抱歉，发生了错误。请检查网络连接或稍后重试。错误信息：' + error.message, true);
    } finally {
        stopResponseTimer();
        sendButton.disabled = false;
        userInput.focus();
    }
}

function createAssistantMessage() {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content typing';
    messageContent.innerHTML = '<span class="typing-cursor"></span>';
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageContent;
}

async function handleStreamResponse(response, messageElement) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留最后一个可能不完整的行
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            fullResponse += content;
                            updateAssistantMessage(messageElement, fullResponse, false);
                        }
                    } catch (e) {
                        console.warn('Failed to parse JSON:', data);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
    
    // 完成响应，移除打字光标
    updateAssistantMessage(messageElement, fullResponse, true);
    
    // 添加到对话历史
    conversationHistory.push({
        role: "assistant",
        content: fullResponse
    });
}

function updateAssistantMessage(element, content, isComplete = false) {
    const formattedContent = formatMessage(content);
    if (isComplete) {
        element.className = 'message-content';
        element.innerHTML = formattedContent;
    } else {
        element.innerHTML = formattedContent + '<span class="typing-cursor"></span>';
    }
    
    // 滚动到底部
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startResponseTimer() {
    startTime = Date.now();
    const loading = document.getElementById('loading');
    loading.style.display = 'flex';
    
    responseTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const timerElement = document.querySelector('.timer-text');
        if (timerElement) {
            timerElement.textContent = `AI正在思考中... ${elapsed}秒`;
        } else {
            loading.innerHTML = `
                <div class="spinner"></div>
                <span class="timer-text">AI正在思考中... ${elapsed}秒</span>
            `;
        }
    }, 100);
}

function stopResponseTimer() {
    if (responseTimer) {
        clearInterval(responseTimer);
        responseTimer = null;
    }
    const loading = document.getElementById('loading');
    loading.style.display = 'none';
    startTime = null;
}

function addMessageToChat(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 处理换行和代码块
    const formattedContent = formatMessage(content);
    messageContent.innerHTML = formattedContent;
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(content) {
    // 转义HTML特殊字符
    let formatted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // 处理代码块（三个反引号包围的代码）
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // 处理行内代码（单个反引号包围的代码）
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理换行
    formatted = formatted.replace(/\n/g, '<br>');
    
    // 处理粗体文本
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return formatted;
}

// 监听回车键发送消息
document.getElementById('userInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 页面加载完成后聚焦输入框
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('userInput').focus();
});

// 添加CSS样式用于代码显示和打字效果
const style = document.createElement('style');
style.textContent = `
    pre {
        background-color: #f4f4f4;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        margin: 10px 0;
        overflow-x: auto;
        font-family: 'Courier New', Courier, monospace;
    }
    
    code {
        background-color: #f4f4f4;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
    }
    
    pre code {
        background-color: transparent;
        padding: 0;
    }
    
    .typing-cursor {
        display: inline-block;
        width: 2px;
        height: 1em;
        background-color: #667eea;
        margin-left: 2px;
        animation: blink 1s infinite;
        vertical-align: text-bottom;
    }
    
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
    }
    
    .timer-text {
        color: white;
        font-weight: 500;
    }
    
    .back-button {
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    
    .back-button:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-1px);
    }
    
    .header-nav {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .header-content {
        flex: 1;
    }
    
    @media (max-width: 768px) {
        .header-nav {
            flex-direction: column;
            gap: 15px;
            text-align: center;
        }
        
        .back-button {
            align-self: flex-start;
        }
    }
`;
document.head.appendChild(style);

// 检查是否是询问AI模型的问题
function isAIModelQuestion(message) {
    const lowerMessage = message.toLowerCase();
    const keywords = [
        'ai模型', 'ai model', '模型', '什么模型', '哪个模型', 'model',
        'gpt', 'chatgpt', 'claude', 'deepseek', '深度求索',
        '你是什么', '你是谁', '什么ai', '哪个ai', '基于什么',
        '用的什么', '采用什么', '技术栈', '底层模型', '语言模型'
    ];
    
    return keywords.some(keyword => lowerMessage.includes(keyword));
}