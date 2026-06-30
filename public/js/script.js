// ============================================
// SAI GON PHOENIX - SCRIPT.JS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ===== 1. AUTO DISMISS FLASH MESSAGES =====
    const alerts = document.querySelectorAll('.alert-dismissible');
    alerts.forEach(alert => {
        setTimeout(() => {
            const closeBtn = alert.querySelector('.btn-close');
            if (closeBtn) {
                closeBtn.click();
            }
        }, 5000);
    });
    
    // ===== 2. DATETIME PICKER - MIN VALUE =====
    const dateInput = document.querySelector('input[type="datetime-local"]');
    if (dateInput) {
        const now = new Date();
        // Set minimum to now + 2 hours
        const minDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const localDateTime = minDate.toISOString().slice(0, 16);
        dateInput.min = localDateTime;
        
        // Set default value to now + 3 hours
        const defaultDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        dateInput.value = defaultDate.toISOString().slice(0, 16);
    }
    
    // ===== 3. FORM VALIDATION =====
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = this.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.classList.add('is-invalid');
                    isValid = false;
                } else {
                    field.classList.remove('is-invalid');
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                // Scroll to first invalid field
                const firstInvalid = this.querySelector('.is-invalid');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
                // Show alert
                showAlert('Vui lòng điền đầy đủ thông tin bắt buộc', 'danger');
            }
        });
        
        // Remove invalid class on input
        form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('input', function() {
                if (this.classList.contains('is-invalid') && this.value.trim()) {
                    this.classList.remove('is-invalid');
                }
            });
            field.addEventListener('change', function() {
                if (this.classList.contains('is-invalid') && this.value.trim()) {
                    this.classList.remove('is-invalid');
                }
            });
        });
    });
    
    // ===== 4. PHONE NUMBER FORMAT =====
    const phoneInput = document.querySelector('input[type="tel"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, '');
            if (value.length > 10) {
                value = value.slice(0, 10);
            }
            if (value.length > 4) {
                value = value.slice(0, 4) + ' ' + value.slice(4);
            }
            if (value.length > 8) {
                value = value.slice(0, 8) + ' ' + value.slice(8);
            }
            this.value = value;
        });
    }
    
    // ===== 5. PASSWORD STRENGTH =====
    const passwordInput = document.querySelector('input[name="password"]');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = getPasswordStrength(password);
            const indicator = this.parentElement.querySelector('.password-strength');
            
            if (indicator) {
                indicator.textContent = strength.text;
                indicator.className = `password-strength badge bg-${strength.class} ms-2`;
            }
        });
    }
    
    function getPasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.match(/[a-z]/)) score++;
        if (password.match(/[A-Z]/)) score++;
        if (password.match(/[0-9]/)) score++;
        if (password.match(/[^a-zA-Z0-9]/)) score++;
        
        const levels = [
            { text: 'Rất yếu', class: 'danger' },
            { text: 'Yếu', class: 'danger' },
            { text: 'Trung bình', class: 'warning' },
            { text: 'Mạnh', class: 'success' },
            { text: 'Rất mạnh', class: 'success' }
        ];
        
        return levels[Math.min(score, 4)];
    }
    
    // ===== 6. CONFIRM PASSWORD =====
    const confirmPasswordInput = document.querySelector('input[name="confirmPassword"]');
    if (confirmPasswordInput && passwordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const confirmMessage = this.parentElement.querySelector('.confirm-message');
            if (confirmMessage) {
                if (this.value === passwordInput.value && this.value !== '') {
                    confirmMessage.textContent = '✓ Mật khẩu khớp';
                    confirmMessage.className = 'confirm-message text-success small';
                } else if (this.value !== '') {
                    confirmMessage.textContent = '✗ Mật khẩu không khớp';
                    confirmMessage.className = 'confirm-message text-danger small';
                } else {
                    confirmMessage.textContent = '';
                }
            }
        });
    }
    
    // ===== 7. SHOW TOAST =====
    window.showAlert = function(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        }
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    };
    
    // ===== 8. NAVBAR ACTIVE LINK =====
    const currentPath = window.location.pathname;
    document.querySelectorAll('.navbar-custom .nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
    
    // ===== 9. SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    console.log('🚀 SaiGonPhoenix loaded successfully!');
});