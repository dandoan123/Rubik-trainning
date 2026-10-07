# LL Trainer

Web app cho người học Rubik 3x3, gồm hai trang:

- **Công thức**: nhập trường hợp tầng 3 (OLL, PLL) đang có trên tay bằng cube 3D, nhận danh sách công thức
  đã xếp hạng theo độ dễ thực hiện (finger trick), rồi xem công thức chạy từng bước. Quy ước cầm cube: vàng
  ở trên, trắng ở dưới; với PLL thì tâm xanh lá hướng về người giải.
- **Timer** (`#/timer`): bấm giờ kiểu csTimer, kèm lời giải gợi ý theo CFOP cho từng đề.

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

## Timer

- **Bấm giờ**: giữ phím cách (hoặc giữ ngón tay trên vùng đồng hồ) 0,3 giây rồi thả để bắt đầu; bấm phím
  bất kỳ hoặc chạm để dừng; Esc huỷ lần đang chạy. Tuỳ chọn 15 giây quan sát, quá giờ thì +2 rồi DNF.
- **Đề**: 3×3 đầy đủ (25 move ngẫu nhiên, cầm trắng trên – xanh lá trước), và đề luyện riêng PLL / OLL dựng
  từ cơ sở dữ liệu công thức, chọn được những trường hợp muốn luyện.
- **Phiên luyện**: mỗi loại đề có danh sách riêng, lưu trong `localStorage` của trình duyệt (không đồng bộ
  giữa các máy), phạt +2 / DNF, xuất CSV.
- **Thống kê**: single, mo3, ao5, ao12, ao50, ao100 (hiện tại và tốt nhất), biểu đồ xu hướng, và với đề
  PLL / OLL là thời gian theo từng trường hợp — bấm vào trường hợp chậm để mở công thức của nó.

### Lời giải gợi ý (CFOP)

Với mỗi đề, `src/cfop` tính một lời giải CFOP cho **cả sáu màu cross** rồi xếp hạng, và phát lời giải đó
từng bước trên cube 3D:

1. **Cross** — ngắn nhất có thể. Một bảng khoảng cách cho toàn bộ trạng thái của bốn cạnh cross cho ra mọi
   lời giải ngắn nhất ở cả 24 cách cầm cube; cái thuận tay nhất được chọn.
2. **F2L** — mỗi cặp được chèn bằng cách chèn ngắn nhất (tìm kiếm IDA*, không xoay mặt dưới, giữ nguyên
   cross và các cặp đã xong), cặp dễ nhất làm trước, có xét việc xoay cả cube (`y`) cho thuận tay.
3. **OLL, PLL** — nhận diện rồi lấy công thức tốt nhất từ cơ sở dữ liệu của trang Công thức.

Cross là tối ưu thật sự; F2L tối ưu theo từng cặp chứ không phải cho cả bốn cặp cùng lúc, nên lời giải là
một gợi ý tốt (trung bình khoảng 54 move) chứ không phải lời giải ngắn nhất tuyệt đối.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/cube` | Mô hình cube 54 ô, bảng hoán vị các move (sinh từ hình học), đọc ký hiệu công thức |
| `src/data` | 57 trường hợp OLL, 21 trường hợp PLL và các công thức |
| `src/solver` | Suy luận đầu vào, tìm công thức khớp, mô hình chấm điểm finger trick |
| `src/finder` | Trang Công thức |
| `src/timer` | Trang Timer: sinh đề, đồng hồ, thống kê, lưu trữ, biểu đồ |
| `src/cfop` | Bộ giải CFOP (cross, F2L, ghép lời giải) và thẻ hiển thị lời giải |
| `src/view` | Cube 3D (three.js), sơ đồ 2D, trình phát, danh sách trường hợp |

## Thêm công thức

Thêm chuỗi vào mảng `algs` của trường hợp trong `src/data/oll.ts` hoặc `src/data/pll.ts` (công thức phổ biến
nhất đứng đầu; dấu ngoặc chỉ để nhóm trigger) rồi chạy `npm test`. Bộ test sẽ báo nếu công thức làm hỏng hai
tầng dưới hoặc thực ra giải một trường hợp khác.

## Giao diện

Giao diện tối, một màu nhấn duy nhất là tím — màu không trùng với sticker nào, để trạng thái của giao diện
không bao giờ bị nhầm với màu trên cube. Các quy tắc đang áp dụng: vùng chạm tối thiểu 44px trên màn hình
cảm ứng, focus ring cho bàn phím, không truyền thông tin chỉ bằng màu, tôn trọng `prefers-reduced-motion`.
