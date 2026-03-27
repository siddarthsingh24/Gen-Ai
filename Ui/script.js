class DSA_Chatbot {
    constructor() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.historyList = document.getElementById('historyList');
        
        this.messages = [];
        this.chatHistory = this.loadChatHistory();
        this.currentChatId = this.generateChatId();
        this.isLoading = false;
        
        // Auto-detect API URL based on environment
        this.API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000/api/chat'
            : '/api/chat';  // Works on Render and other production hosts
        
        console.log('Chatbot initialized with API URL:', this.API_URL);
        
        this.initEventListeners();
        this.displayWelcomeMessage();
        this.addTooltips();
    }
    
    initEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        
        // Auto-resize textarea
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 120) + 'px';
        });
        
        // Suggestion chips (will be re-attached after each new chat)
        this.attachSuggestionListeners();
        
        // Clear input on escape
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.userInput.value = '';
                this.userInput.style.height = 'auto';
            }
        });
    }
    
    attachSuggestionListeners() {
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.removeEventListener('click', this.suggestionClickHandler);
            this.suggestionClickHandler = () => {
                this.userInput.value = chip.dataset.question;
                this.userInput.style.height = 'auto';
                this.userInput.focus();
                this.sendMessage();
            };
            chip.addEventListener('click', this.suggestionClickHandler);
        });
    }
    
    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message || this.isLoading) return;
        
        // Clear input
        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        
        // Add user message to UI
        this.addMessage(message, 'user');
        
        // Show typing indicator
        this.showTypingIndicator();
        this.isLoading = true;
        this.sendBtn.disabled = true;
        
        try {
            // Call backend API
            const response = await this.callGeminiAPI(message);
            this.removeTypingIndicator();
            this.addMessage(response, 'assistant');
            
            // Save to history
            this.saveMessageToHistory(message, response);
            
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
            this.showErrorAnimation();
            console.error('Error:', error);
        } finally {
            this.isLoading = false;
            this.sendBtn.disabled = false;
            this.userInput.focus();
        }
    }
    
    async callGeminiAPI(question) {
        this.showColdStartNotice();
        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: question })
            });
            
            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error('Server is starting up. Please wait a moment and try again.');
                } else if (response.status === 404) {
                    throw new Error('API endpoint not found. Please check server configuration.');
                } else {
                    throw new Error(`API request failed with status ${response.status}`);
                }
            }
            
            const data = await response.json();
            return data.response || data.text || 'No response received';
            
        } catch (error) {
            console.error('API Error:', error);
            // Enhanced error message based on environment
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const errorMsg = error.message.includes('Failed to fetch') 
                ? isLocalhost 
                    ? "❌ Connection error: Cannot reach the server. Make sure your backend is running on http://localhost:3000" 
                    : "❌ Connection error: Server is waking up. Please wait 20-30 seconds and try again. (Free tier cold start)"
                : "❌ " + error.message;
            return errorMsg;
        }
    }
    showColdStartNotice() {
        const notice = document.createElement('div');
        notice.className = 'cold-start-notice';
        notice.innerHTML = `
          <i class="fas fa-coffee"></i>
          <span>Waking up server (free tier cold start). This may take 20-30 seconds...</span>
    `;
    this.messagesContainer.appendChild(notice);
    setTimeout(() => notice.remove(), 5000);
}
    
    addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Format content with markdown-like syntax
        contentDiv.innerHTML = this.formatMessage(content);
        
        // Add copy button for code blocks
        this.addCopyButtons(contentDiv);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Store message
        this.messages.push({ content, role, timestamp: new Date() });
        
        // Hide welcome message if it exists
        const welcomeDiv = document.querySelector('.welcome-message');
        if (welcomeDiv) welcomeDiv.style.display = 'none';
    }
    
    formatMessage(content) {
        let formatted = content;
        
        // Format code blocks
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'plaintext'}">${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // Format inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Format bold text
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Format italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Format line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Format bullet points
        formatted = formatted.replace(/^\s*[-*]\s+(.+)/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        return formatted;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    addCopyButtons(contentDiv) {
        const codeBlocks = contentDiv.querySelectorAll('pre');
        codeBlocks.forEach(block => {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.setAttribute('data-tooltip', 'Copy code');
            copyBtn.style.position = 'absolute';
            copyBtn.style.top = '8px';
            copyBtn.style.right = '8px';
            copyBtn.style.background = 'rgba(0,0,0,0.5)';
            copyBtn.style.border = 'none';
            copyBtn.style.color = 'white';
            copyBtn.style.borderRadius = '6px';
            copyBtn.style.padding = '4px 8px';
            copyBtn.style.cursor = 'pointer';
            copyBtn.style.fontSize = '12px';
            copyBtn.style.transition = 'all 0.3s';
            
            copyBtn.addEventListener('click', async () => {
                const code = block.querySelector('code');
                if (code) {
                    await navigator.clipboard.writeText(code.textContent);
                    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                }
            });
            
            block.style.position = 'relative';
            block.appendChild(copyBtn);
        });
    }
    
    showTypingIndicator() {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'message assistant';
        indicatorDiv.id = 'typingIndicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        indicatorDiv.appendChild(avatar);
        indicatorDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(indicatorDiv);
        this.scrollToBottom();
    }
    
    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }
    
    scrollToBottom() {
        // Add a small delay to ensure DOM has updated
        setTimeout(() => {
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    }
    
    showErrorAnimation() {
        const inputWrapper = document.querySelector('.input-wrapper');
        inputWrapper.classList.add('error-animation');
        setTimeout(() => {
            inputWrapper.classList.remove('error-animation');
        }, 500);
    }
    
    addTooltips() {
        if (this.sendBtn) {
            this.sendBtn.setAttribute('data-tooltip', 'Send message (Enter)');
            this.sendBtn.title = 'Send message (Enter)';
        }
        if (this.newChatBtn) {
            this.newChatBtn.setAttribute('data-tooltip', 'Start new conversation');
            this.newChatBtn.title = 'Start new conversation';
        }
    }
    
    displayWelcomeMessage() {
        // Check if there are existing messages
        if (this.messages.length === 0) {
            const welcomeDiv = document.querySelector('.welcome-message');
            if (welcomeDiv) welcomeDiv.style.display = 'block';
        } else {
            const welcomeDiv = document.querySelector('.welcome-message');
            if (welcomeDiv) welcomeDiv.style.display = 'none';
        }
    }
    
    startNewChat() {
        if (this.isLoading) return;
        
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.currentChatId = this.generateChatId();
        
        // Recreate welcome message
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-icon">
                <i class="fas fa-robot"></i>
            </div>
            <h2>Welcome to DSA Tutor!</h2>
            <p>Ask me anything about Data Structures and Algorithms. I'll help you solve problems with clear explanations and efficient solutions.</p>
            <div class="suggestions">
                <button class="suggestion-chip" data-question="Explain binary search with example">
                    <i class="fas fa-search"></i>
                    Binary Search
                </button>
                <button class="suggestion-chip" data-question="How to reverse a linked list?">
                    <i class="fas fa-link"></i>
                    Reverse Linked List
                </button>
                <button class="suggestion-chip" data-question="Explain dynamic programming approach">
                    <i class="fas fa-chart-line"></i>
                    Dynamic Programming
                </button>
                <button class="suggestion-chip" data-question="Time complexity of quicksort">
                    <i class="fas fa-clock"></i>
                    QuickSort Complexity
                </button>
                <button class="suggestion-chip" data-question="What is the difference between array and linked list?">
                    <i class="fas fa-code-branch"></i>
                    Array vs Linked List
                </button>
                <button class="suggestion-chip" data-question="Explain BFS and DFS algorithms">
                    <i class="fas fa-project-diagram"></i>
                    BFS & DFS
                </button>
            </div>
        `;
        
        this.messagesContainer.appendChild(welcomeDiv);
        
        // Reattach suggestion listeners
        this.attachSuggestionListeners();
        this.displayWelcomeMessage();
        
        // Focus on input
        this.userInput.focus();
    }
    
    saveMessageToHistory(userMessage, assistantMessage) {
        const chatData = {
            id: this.currentChatId,
            title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : ''),
            messages: [...this.messages],
            timestamp: new Date().toISOString(),
            preview: userMessage.slice(0, 40)
        };
        
        const existingIndex = this.chatHistory.findIndex(chat => chat.id === this.currentChatId);
        if (existingIndex !== -1) {
            this.chatHistory[existingIndex] = chatData;
        } else {
            this.chatHistory.unshift(chatData);
        }
        
        // Keep only last 50 chats
        if (this.chatHistory.length > 50) this.chatHistory.pop();
        
        this.saveChatHistory();
        this.updateHistoryList();
    }
    
    updateHistoryList() {
        if (!this.historyList) return;
        
        this.historyList.innerHTML = '';
        
        if (this.chatHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'history-empty';
            emptyMessage.textContent = 'No conversations yet';
            emptyMessage.style.color = 'rgba(255,255,255,0.5)';
            emptyMessage.style.fontSize = '12px';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.padding = '20px';
            this.historyList.appendChild(emptyMessage);
            return;
        }
        
        this.chatHistory.slice(0, 10).forEach(chat => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-item-title">${this.escapeHtml(chat.title)}</div>
                <div class="history-item-time">${this.formatTime(chat.timestamp)}</div>
            `;
            historyItem.addEventListener('click', () => this.loadChat(chat.id));
            this.historyList.appendChild(historyItem);
        });
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
    
    loadChat(chatId) {
        if (this.isLoading) return;
        
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (chat) {
            this.messages = [...chat.messages];
            this.currentChatId = chat.id;
            this.renderMessages();
        }
    }
    
    renderMessages() {
        this.messagesContainer.innerHTML = '';
        this.messages.forEach(msg => {
            this.addMessage(msg.content, msg.role);
        });
        this.displayWelcomeMessage();
        this.scrollToBottom();
    }
    
    generateChatId() {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    saveChatHistory() {
        try {
            localStorage.setItem('dsa_chat_history', JSON.stringify(this.chatHistory));
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }
    
    loadChatHistory() {
        try {
            const saved = localStorage.getItem('dsa_chat_history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Failed to load chat history:', error);
            return [];
        }
    }
    
    // Clear all chat history
    clearAllHistory() {
        if (confirm('Are you sure you want to clear all chat history?')) {
            this.chatHistory = [];
            this.saveChatHistory();
            this.updateHistoryList();
            this.startNewChat();
        }
    }
}

// Add CSS for history items and error animation
const style = document.createElement('style');
style.textContent = `
    .history-item {
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-bottom: 8px;
    }
    
    .history-item:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateX(4px);
    }
    
    .history-item-title {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .history-item-time {
        font-size: 10px;
        opacity: 0.6;
    }
    
    .error-animation {
        animation: shake 0.3s ease-in-out;
        border-color: #ef4444 !important;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .copy-btn {
        opacity: 0;
        transition: opacity 0.3s;
    }
    
    pre:hover .copy-btn {
        opacity: 1;
    }
    
    .typing-indicator {
        display: flex;
        gap: 6px;
        padding: 12px 16px;
        background: white;
        border-radius: 20px;
        width: fit-content;
    }
    
    .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
        animation: typingBounce 1.4s infinite;
    }
    
    .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typingBounce {
        0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
        }
        30% {
            transform: translateY(-10px);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new DSA_Chatbot();
});
