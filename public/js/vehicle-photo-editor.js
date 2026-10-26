document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-photo-group]').forEach(group => {
        const urls = group.querySelector('[data-photo-urls]');
        group.querySelectorAll('[data-remove-photo]').forEach(button => button.addEventListener('click', () => {
            const item = button.closest('[data-existing-photo]');
            urls.value = urls.value.split(/\r?\n/).filter(url => url.trim() !== item.dataset.url).join('\n');
            item.remove();
            group.querySelector('summary small').textContent = `${urls.value.split(/\r?\n/).filter(url => url.trim()).length} ảnh giữ lại`;
        }));
        const input = group.querySelector('[data-photo-files]'), preview = group.querySelector('[data-photo-file-preview]');
        let objectUrls = [];
        input.addEventListener('change', () => {
            objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls = []; preview.replaceChildren();
            const files = Array.from(input.files), max = group.dataset.photoGroup === 'spin' ? 36 : 12;
            const invalid = files.length > max || files.some(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type));
            input.setCustomValidity(invalid ? `Chọn tối đa ${max} ảnh JPG, PNG, WEBP hoặc GIF, mỗi ảnh không quá 5 MB.` : '');
            if (invalid) { preview.textContent = input.validationMessage; input.reportValidity(); return; }
            if (group.dataset.photoGroup === 'spin') files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
            files.forEach(file => { const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption'); const url = URL.createObjectURL(file); objectUrls.push(url); image.src = url; image.alt = file.name; caption.textContent = file.name; figure.append(image, caption); preview.append(figure); });
        });
        window.addEventListener('pagehide', () => objectUrls.forEach(url => URL.revokeObjectURL(url)), { once: true });
    });
});
