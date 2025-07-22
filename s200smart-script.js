const API_KEY = 'sk-111a4f87af724cd4b3a9c3e6bc8f85ab';
const BASE_URL = 'https://api.deepseek.com';

// S7-200 SMART程序模板
const S200_SMART_TEMPLATE = `
按照下面的程序格式思路和方法写程序：

ORGANIZATION_BLOCK MAIN:OB1
TITLE=顺序控制程序
BEGIN
Network 1 
//   初始化状态
LD     SM0.1
S      M0.0, 1

Network 2 
//   初始状态，等待启动按钮
LD     M0.0
A      I0.0                        // 非急停状态
R      M0.0, 1                     // 启动按钮
S      M0.1, 1


Network 3 
//   状态1：输出1，延时2秒
LD     M0.1
S      Q0.0, 1                     // 非急停状态
TON    T37, 20
A      T37                         // 2秒 (20x100ms)

R      M0.1, 1
S      M0.2, 1


Network 4 
//   状态2：输出2，延时3秒
LD     M0.2
S      Q0.1, 1                     // 非急停状态
TON    T38, 30
A      T38                         // 3秒 (30x100ms)

R      M0.2, 1
S      M0.3, 1


Network 5 
//   状态3：输出3，延时6秒
LD     M0.3
S      Q0.2, 1                     // 非急停状态
TON    T39, 60
A      T39                         // 6秒 (60x100ms)

R      M0.3, 1
S      M0.4, 1


Network 6 
//   状态4：输出4，延时2秒
LD     M0.4
S      Q0.3, 1                     // 非急停状态
TON    T40, 20
A      T40                         // 2秒 (20x100ms)

R      M0.4, 1
S      M0.5, 1


Network 7 
//   状态5：延时3秒
LD     M0.5
S      Q0.4, 1                     // 非急停状态
TON    T41, 30                     // 3秒 (30x100ms)

A      T41
R      M0.5, 1
S      M0.6, 1

Network 8 
//   状态6：延时3秒
LD     M0.6
TON    T42, 30                     // 非急停状态
A      T42                         // 3秒 (30x100ms)

R      M0.6, 1
S      M0.7, 1


Network 9 
//   状态7：延时2秒
LD     M0.7
TON    T43, 20                     // 非急停状态
A      T43                         // 3秒 (30x100ms)

R      M0.7, 1
S      M1.0, 1


Network 10 
//   状态8：延时2秒
LD     M1.0
TON    T44, 20                     // 非急停状态
A      T44                         // 3秒 (30x100ms)

R      M1.0, 1
S      M1.1, 1


Network 11 
//   状态9：延时5秒
LD     M1.1
TON    T45, 50                     // 非急停状态
A      T45                         // 3秒 (30x100ms)

R      M1.1, 1
S      M1.2, 1


Network 12 
//   状态9：延时5秒
LD     M1.2
TON    T46, 50                     // 非急停状态
A      T46                         // 3秒 (30x100ms)

R      Q0.0, 1
R      Q0.1, 1
R      Q0.2, 1

R      Q0.3, 1
R      Q0.4, 1
S      M0.0, 1
R      M1.2, 1
END_ORGANIZATION_BLOCK
SUBROUTINE_BLOCK SBR_0:SBR0
TITLE=子程序
BEGIN
Network 1 
//   预留子程序
END_SUBROUTINE_BLOCK
INTERRUPT_BLOCK INT_0:INT0
TITLE=中断程序
BEGIN
Network 1 
//   预留中断程序
END_INTERRUPT_BLOCK
`;

let conversationHistory = [
    {
        role: "system",
        content: "你是一个专业的西门子S7-200 SMART PLC编程专家助手。你精通S7-200 SMART系列PLC的所有编程语言和功能，包括梯形图（LAD）、指令表（STL）、功能块图（FBD）等。你熟悉S7-200 SMART的硬件配置、I/O地址分配、通信功能、定时器计数器应用、数据类型和指令集。请用中文回答，提供专业、准确、实用的S7-200 SMART编程建议和解决方案。"
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
    
    // 将用户消息和程序模板一起添加到对话历史
    const messageWithTemplate = message + "\n\n" + S200_SMART_TEMPLATE;
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