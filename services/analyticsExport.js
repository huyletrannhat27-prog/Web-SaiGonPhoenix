const ExcelJS = require('exceljs');

const colors = { navy: '16213E', rose: 'D92F52', green: '149D62', blue: '3178C6', gold: 'E4A11B', light: 'F4F6FA', border: 'D9E0EA', text: '263247', muted: '697386', white: 'FFFFFF' };

function safeCsvValue(value) {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createAnalyticsCsv(analytics) {
    const headers = ['Mã đơn','Ngày tạo','Ngày chạy','Khách hàng','Điện thoại','Loại chuyến','Sân bay','Điểm đón','Điểm trả','Xe','Tài xế','Trạng thái','Tổng tiền','Đã nhận','Điểm chuyến','Điểm tài xế','Nhận xét'];
    const rows = analytics.records.map(item => [item.code, item.createdAt ? new Date(item.createdAt).toISOString() : '', item.bookingDate ? new Date(item.bookingDate).toISOString() : '', item.customerName, item.phone, item.tripType, item.airport, item.pickup, item.dropoff, item.vehicle, item.driver, item.statusLabel, item.totalPrice, item.paidAmount, item.tripRating ?? '', item.driverRating ?? '', item.reviewComment]);
    return `\uFEFF${[headers, ...rows].map(row => row.map(safeCsvValue).join(',')).join('\r\n')}`;
}

function applyHeader(row) {
    row.height = 28;
    row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
        cell.font = { bold: true, color: { argb: colors.white }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
}

function applyDataSheet(sheet, columns, rows, tableName) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.properties.defaultRowHeight = 20;
    sheet.columns = columns;
    sheet.addRows(rows);
    applyHeader(sheet.getRow(1));
    sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(columns.length).letter}${Math.max(2, rows.length + 1)}` };
    sheet.getRows(2, rows.length)?.forEach((row, index) => {
        if (index % 2) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFD' } };
        row.alignment = { vertical: 'top', wrapText: true };
    });
    if (rows.length) sheet.addTable({ name: tableName, ref: 'A1', headerRow: true, totalsRow: false, style: { theme: 'TableStyleMedium2', showRowStripes: true }, columns: columns.map(item => ({ name: item.header })), rows: rows.map(row => columns.map(column => row[column.key] ?? null)) });
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function metricCard(sheet, labelCell, valueCell, label, value, color, numberFormat) {
    sheet.getCell(labelCell).value = label;
    sheet.getCell(labelCell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    sheet.getCell(labelCell).font = { bold: true, color: { argb: colors.white }, size: 10 };
    sheet.getCell(valueCell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
    sheet.getCell(valueCell).font = { bold: true, color: { argb: colors.text }, size: 18 };
    sheet.getCell(valueCell).value = value;
    sheet.getCell(valueCell).numFmt = numberFormat || '#,##0';
    [labelCell, valueCell].forEach(ref => { sheet.getCell(ref).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; sheet.getCell(ref).border = { left: { style: 'thin', color: { argb: colors.border } }, right: { style: 'thin', color: { argb: colors.border } }, top: { style: 'thin', color: { argb: colors.border } }, bottom: { style: 'thin', color: { argb: colors.border } } }; });
}

async function createAnalyticsWorkbook(analytics) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SaiGonPhoenix'; workbook.created = new Date(); workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;
    const overview = workbook.addWorksheet('Tổng quan', { views: [{ showGridLines: false }] });
    overview.columns = Array.from({ length: 10 }, (_, index) => ({ width: index === 0 ? 3 : 15 }));
    overview.mergeCells('B2:J3'); overview.getCell('B2').value = 'BÁO CÁO PHÂN TÍCH VẬN HÀNH';
    overview.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
    overview.getCell('B2').font = { bold: true, color: { argb: colors.white }, size: 20 };
    overview.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' };
    overview.mergeCells('B4:J4'); overview.getCell('B4').value = `${analytics.range.label} · Xuất lúc ${new Date(analytics.generatedAt).toLocaleString('vi-VN')}`;
    overview.getCell('B4').font = { italic: true, color: { argb: colors.muted }, size: 10 }; overview.getCell('B4').alignment = { horizontal: 'center' };
    metricCard(overview, 'B6', 'B7', 'SỐ CHUYẾN ĐẶT', { formula: `COUNTA('Đơn xe'!A2:A${Math.max(2, analytics.records.length + 1)})`, result: analytics.metrics.totalBookings }, colors.blue);
    metricCard(overview, 'D6', 'D7', 'CHUYẾN HOÀN THÀNH', { formula: `COUNTIF('Đơn xe'!L2:L${Math.max(2, analytics.records.length + 1)},"Hoàn thành")`, result: analytics.metrics.completedBookings }, colors.green);
    metricCard(overview, 'F6', 'F7', 'TỶ LỆ HOÀN THÀNH', { formula: 'IF(B7=0,0,D7/B7)', result: analytics.metrics.completionRate / 100 }, colors.gold, '0%');
    metricCard(overview, 'H6', 'H7', 'SỐ ĐÁNH GIÁ', { formula: `COUNTA('Đánh giá'!A2:A${Math.max(2, analytics.reviews.length + 1)})`, result: analytics.metrics.totalReviews }, colors.rose);
    metricCard(overview, 'J6', 'J7', 'MỨC HÀI LÒNG', { formula: `IFERROR((AVERAGE('Đánh giá'!F2:F${Math.max(2, analytics.reviews.length + 1)})+AVERAGE('Đánh giá'!G2:G${Math.max(2, analytics.reviews.length + 1)}))/10,0)`, result: analytics.metrics.satisfaction / 100 }, colors.navy, '0%');
    overview.getRow(6).height = 25; overview.getRow(7).height = 42;
    overview.getCell('B10').value = 'Trạng thái chuyến'; overview.getCell('B10').font = { bold: true, size: 13, color: { argb: colors.navy } };
    const statusStart = 11;
    overview.getRow(statusStart).values = [null, 'Trạng thái', 'Số chuyến', 'Tỷ trọng']; applyHeader(overview.getRow(statusStart));
    analytics.status.forEach((item, index) => {
        const row = statusStart + index + 1;
        overview.getCell(`B${row}`).value = item.label; overview.getCell(`C${row}`).value = item.count;
        overview.getCell(`D${row}`).value = { formula: `IF($B$7=0,0,C${row}/$B$7)`, result: analytics.metrics.totalBookings ? item.count / analytics.metrics.totalBookings : 0 };
        overview.getCell(`D${row}`).numFmt = '0.0%';
    });
    overview.getCell('F10').value = 'Tài xế theo chuyến hoàn thành'; overview.getCell('F10').font = { bold: true, size: 13, color: { argb: colors.navy } };
    overview.getRow(statusStart).getCell(6).value = 'Tài xế'; overview.getRow(statusStart).getCell(7).value = 'Đã chạy'; overview.getRow(statusStart).getCell(8).value = 'Hoàn thành'; overview.getRow(statusStart).getCell(9).value = 'Điểm TB';
    ['F','G','H','I'].forEach(letter => { const cell = overview.getCell(`${letter}${statusStart}`); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } }; cell.font = { bold: true, color: { argb: colors.white }, size: 10 }; cell.alignment = { horizontal: 'center' }; });
    analytics.drivers.slice(0, 10).forEach((driver, index) => {
        const row = statusStart + index + 1;
        overview.getCell(`F${row}`).value = driver.name; overview.getCell(`G${row}`).value = driver.assignedTrips; overview.getCell(`H${row}`).value = driver.completedTrips; overview.getCell(`I${row}`).value = driver.averageOverall; overview.getCell(`I${row}`).numFmt = '0.0';
    });
    overview.getCell('B23').value = 'Ghi chú'; overview.getCell('B23').font = { bold: true, color: { argb: colors.rose } };
    overview.mergeCells('B24:J25'); overview.getCell('B24').value = 'Số liệu được lọc theo ngày chạy chuyến. Chỉ số tài xế dùng tài xế đã gán tại thời điểm xác nhận; đơn cũ chưa có lịch sử gán sẽ dùng tài xế hiện tại của xe.';
    overview.getCell('B24').alignment = { wrapText: true, vertical: 'top' }; overview.getCell('B24').font = { color: { argb: colors.muted }, size: 10 };
    overview.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

    const bookingsSheet = workbook.addWorksheet('Đơn xe', { views: [{ showGridLines: false }] });
    const bookingColumns = [
        { header:'Mã đơn',key:'code',width:14},{header:'Ngày tạo',key:'createdAt',width:19,style:{numFmt:'dd/mm/yyyy hh:mm'}},{header:'Ngày chạy',key:'bookingDate',width:19,style:{numFmt:'dd/mm/yyyy hh:mm'}},
        {header:'Khách hàng',key:'customerName',width:22},{header:'Điện thoại',key:'phone',width:15},{header:'Loại chuyến',key:'tripType',width:18},{header:'Sân bay',key:'airport',width:30},
        {header:'Điểm đón',key:'pickup',width:28},{header:'Điểm trả',key:'dropoff',width:28},{header:'Xe',key:'vehicle',width:20},{header:'Tài xế',key:'driver',width:20},{header:'Trạng thái',key:'statusLabel',width:18},
        {header:'Tổng tiền',key:'totalPrice',width:16,style:{numFmt:'#,##0'}},{header:'Đã nhận',key:'paidAmount',width:16,style:{numFmt:'#,##0'}},{header:'Điểm chuyến',key:'tripRating',width:13,style:{numFmt:'0.0'}},
        {header:'Điểm tài xế',key:'driverRating',width:13,style:{numFmt:'0.0'}},{header:'Nhận xét',key:'reviewComment',width:45},{header:'ID tài xế',key:'driverId',width:26}
    ];
    applyDataSheet(bookingsSheet, bookingColumns, analytics.records.map(item => ({ ...item, createdAt: item.createdAt ? new Date(item.createdAt) : null, bookingDate: item.bookingDate ? new Date(item.bookingDate) : null })), 'BookingsTable');

    const driversSheet = workbook.addWorksheet('Tài xế', { views: [{ showGridLines: false }] });
    const driverColumns = [{header:'Tài xế',key:'name',width:24},{header:'Điện thoại',key:'phone',width:16},{header:'Biển số',key:'licensePlate',width:16},{header:'Đã phân công',key:'assignedTrips',width:16},{header:'Hoàn thành',key:'completedTrips',width:15},{header:'Đang phục vụ',key:'servingTrips',width:16},{header:'Tỷ lệ hoàn thành',key:'completionRate',width:18,style:{numFmt:'0%'}},{header:'Số đánh giá',key:'reviewCount',width:15},{header:'Điểm tài xế',key:'averageDriverRating',width:15,style:{numFmt:'0.0'}},{header:'Điểm chuyến',key:'averageTripRating',width:15,style:{numFmt:'0.0'}},{header:'Điểm tổng hợp',key:'averageOverall',width:16,style:{numFmt:'0.0'}},{header:'ID tài xế',key:'id',width:26}];
    applyDataSheet(driversSheet, driverColumns, analytics.drivers.map(item => ({ ...item, completionRate: item.completionRate / 100 })), 'DriversTable');
    const lastBookingRow = Math.max(2, analytics.records.length + 1);
    analytics.drivers.forEach((driver, index) => {
        const row = index + 2; const idRef = `$L${row}`;
        driversSheet.getCell(`D${row}`).value = { formula: `COUNTIFS('Đơn xe'!$R$2:$R$${lastBookingRow},${idRef},'Đơn xe'!$L$2:$L$${lastBookingRow},"Chờ phục vụ")+COUNTIFS('Đơn xe'!$R$2:$R$${lastBookingRow},${idRef},'Đơn xe'!$L$2:$L$${lastBookingRow},"Hoàn thành")+COUNTIFS('Đơn xe'!$R$2:$R$${lastBookingRow},${idRef},'Đơn xe'!$L$2:$L$${lastBookingRow},"Đã hủy")`, result: driver.assignedTrips };
        driversSheet.getCell(`E${row}`).value = { formula: `COUNTIFS('Đơn xe'!$R$2:$R$${lastBookingRow},${idRef},'Đơn xe'!$L$2:$L$${lastBookingRow},"Hoàn thành")`, result: driver.completedTrips };
        driversSheet.getCell(`F${row}`).value = { formula: `COUNTIFS('Đơn xe'!$R$2:$R$${lastBookingRow},${idRef},'Đơn xe'!$L$2:$L$${lastBookingRow},"Chờ phục vụ")`, result: driver.servingTrips };
        driversSheet.getCell(`G${row}`).value = { formula: `IF(D${row}=0,0,E${row}/D${row})`, result: driver.completionRate / 100 };
        driversSheet.getCell(`H${row}`).value = { formula: `COUNTIFS('Đơn xe'!$R$2:$R$${lastBookingRow},${idRef},'Đơn xe'!$P$2:$P$${lastBookingRow},">0")`, result: driver.reviewCount };
        driversSheet.getCell(`I${row}`).value = { formula: `IFERROR(AVERAGEIFS('Đơn xe'!$P$2:$P$${lastBookingRow},'Đơn xe'!$R$2:$R$${lastBookingRow},${idRef}),0)`, result: driver.averageDriverRating };
        driversSheet.getCell(`J${row}`).value = { formula: `IFERROR(AVERAGEIFS('Đơn xe'!$O$2:$O$${lastBookingRow},'Đơn xe'!$R$2:$R$${lastBookingRow},${idRef}),0)`, result: driver.averageTripRating };
        driversSheet.getCell(`K${row}`).value = { formula: `IF(H${row}=0,0,(I${row}+J${row})/2)`, result: driver.averageOverall };
    });

    const reviewsSheet = workbook.addWorksheet('Đánh giá', { views: [{ showGridLines: false }] });
    const reviewColumns = [{header:'ID đánh giá',key:'id',width:26},{header:'ID đơn',key:'bookingId',width:26},{header:'Ngày đánh giá',key:'createdAt',width:19,style:{numFmt:'dd/mm/yyyy hh:mm'}},{header:'Tài xế',key:'driverName',width:22},{header:'Xe',key:'vehicleName',width:22},{header:'Điểm chuyến',key:'tripRating',width:14,style:{numFmt:'0.0'}},{header:'Điểm tài xế',key:'driverRating',width:14,style:{numFmt:'0.0'}},{header:'Nhận xét',key:'comment',width:60},{header:'Công khai',key:'published',width:13}];
    applyDataSheet(reviewsSheet, reviewColumns, analytics.reviews.map(item => ({ ...item, createdAt: item.createdAt ? new Date(item.createdAt) : null, published: item.isPublished ? 'Có' : 'Không' })), 'ReviewsTable');
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = { createAnalyticsCsv, createAnalyticsWorkbook };
