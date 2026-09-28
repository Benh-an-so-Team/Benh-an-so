# Frontend Pages Structure

Thư mục `frontend/src/pages` được tổ chức chuyên nghiệp, tinh gọn:

```text
src/pages/
├── __tests__/             # Toàn bộ 57 file unit test (*.test.js) của trang và module
├── styles/                # Toàn bộ file stylesheet CSS chuyên biệt của các trang
├── appointment-queue/     # Sub-components và cột dữ liệu hàng đợi khám
└── [*.jsx]                # 70 màn hình trang chính (Page components)
```

### Quy ước:
1. **Trang mới (Page)**: Đặt trực tiếp tại `src/pages/<Name>Page.jsx` hoặc `<Name>.jsx`.
2. **Style riêng của trang**: Đặt tại `src/pages/styles/<name>.css` và import trong Page bằng `import './styles/<name>.css'`.
3. **Unit Test**: Đặt tại `src/pages/__tests__/<Name>Validation.test.js` để tránh lẫn lộn với mã nguồn giao diện.
