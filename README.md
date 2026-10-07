# LL Trainer

Web app giúp người học Rubik 3x3 tìm công thức tầng 3 (OLL và PLL) nhanh nhất, thuận tay nhất cho đúng
trường hợp đang có trên tay: nhập trường hợp trên cube 3D, nhận danh sách công thức đã xếp hạng theo độ dễ
thực hiện (finger trick), rồi xem công thức chạy từng bước.

Quy ước cầm cube: vàng ở trên, trắng ở dưới; với PLL thì tâm xanh lá hướng về người giải.

## Chạy

```bash
npm install
npm run dev      # mở http://localhost:5173
npm test         # kiểm chứng toàn bộ công thức và logic
npm run build    # bản production trong dist/
```

## Deploy

App là static site: build ra thư mục `dist/` với đường dẫn tương đối, nên chạy được cả ở gốc tên miền lẫn
trong thư mục con. Mỗi lần push lên nhánh `main` là tự deploy lại.

- **GitHub Pages**: workflow `.github/workflows/pages.yml` chạy test, build rồi publish. Bật một lần trong
  **Settings → Pages → Source: GitHub Actions**. Trang nằm ở `https://<tài-khoản>.github.io/<tên-repo>/`.
- **Render**: `render.yaml` khai báo sẵn static site. Trên [Render](https://dashboard.render.com) chọn
  **New → Blueprint**, chọn repo này rồi **Apply**.

## Cách hoạt động

**Nhập liệu có suy luận.** Sau mỗi lần nhập, app lọc lại mọi trạng thái hợp lệ còn lại của tầng 3 và tự điền
những gì đã bị ép buộc:

- OLL: chỉ cần bấm vào ô vàng của các viên chưa đúng hướng. Viên góc và viên cạnh cuối cùng được suy ra từ
  quy tắc xoắn góc / lật cạnh.
- PLL: có 288 trạng thái. Nhập 5 ô ở mặt trước và mặt phải là đủ, 7 ô còn lại app tự điền. Màu không thể xảy
  ra ở ô đang nhập bị khoá.

**Tìm công thức.** Mỗi công thức trong cơ sở dữ liệu được thử trực tiếp trên trạng thái đã nhập, với cả bốn
hướng xoay tầng trên, nên kết quả luôn kèm cú căn chỉnh (AUF) cần làm trước và sau.

**Xếp hạng.** `src/solver/fingertrick.ts` ước lượng công sức thực hiện cho người thuận tay phải: theo dõi vị
trí cổ tay hai bàn tay, tính phí regrip khi cổ tay hết biên độ, và định giá từng move theo độ dễ flick từ thế
cầm hiện tại. Đây là mô hình ước lượng, không phải số đo: công thức "phổ biến nhất" luôn được đánh dấu riêng
để người học tự so sánh.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/cube` | Mô hình cube 54 ô, bảng hoán vị các move (sinh từ hình học), đọc ký hiệu công thức |
| `src/data` | 57 trường hợp OLL, 21 trường hợp PLL và các công thức |
| `src/solver` | Suy luận đầu vào, tìm công thức khớp, mô hình chấm điểm finger trick |
| `src/view` | Cube 3D (three.js), sơ đồ 2D, trình phát, danh sách trường hợp |

## Thêm công thức

Thêm chuỗi vào mảng `algs` của trường hợp trong `src/data/oll.ts` hoặc `src/data/pll.ts` (công thức phổ biến
nhất đứng đầu; dấu ngoặc chỉ để nhóm trigger) rồi chạy `npm test`. Bộ test sẽ báo nếu công thức làm hỏng hai
tầng dưới hoặc thực ra giải một trường hợp khác.

## Giao diện

Giao diện tối, một màu nhấn duy nhất là tím — màu không trùng với sticker nào, để trạng thái của giao diện
không bao giờ bị nhầm với màu trên cube. Các quy tắc đang áp dụng: vùng chạm tối thiểu 44px trên màn hình
cảm ứng, focus ring cho bàn phím, không truyền thông tin chỉ bằng màu, tôn trọng `prefers-reduced-motion`.
