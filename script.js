const API_KEY = 'sk-111a4f87af724cd4b3a9c3e6bc8f85ab';
const BASE_URL = 'https://api.deepseek.com';

let conversationHistory = [
    {
        role: "system",
        content: "你是一个专业的PLC（可编程逻辑控制器）编程专家助手。你精通各种PLC编程语言，包括梯形图（LD）、结构化文本（ST）、功能块图（FBD）、指令表（IL）和顺序功能图（SFC）。你可以帮助用户解决PLC编程、调试、故障诊断、硬件选型等相关问题。请用中文回答，提供专业、准确、实用的建议。"
    }
];

let responseTimer = null;
let startTime = null;

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const sendButton = document.getElementById('sendButton');
    const loading = document.getElementById('loading');
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // 添加用户消息到界面
    addMessageToChat('user', message);
    
    // 添加到对话历史
    conversationHistory.push({
        role: "user",
        content: message
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
`;
document.head.appendChild(style);