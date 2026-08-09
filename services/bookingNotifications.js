const messages = {
    vi: code => `Đặt xe thành công! Mã đơn của bạn là ${code}.`,
    en: code => `Booking successful! Your booking ID is ${code}.`,
    'zh-CN': code => `订车成功！您的订单编号是 ${code}。`,
    ko: code => `예약이 완료되었습니다! 예약 번호는 ${code}입니다.`,
    ja: code => `予約が完了しました！予約番号は ${code} です。`,
    th: code => `จองรถสำเร็จ! รหัสการจองของคุณคือ ${code}`,
    fr: code => `Réservation réussie ! Votre numéro de réservation est ${code}.`,
    de: code => `Buchung erfolgreich! Ihre Buchungsnummer lautet ${code}.`,
    es: code => `¡Reserva realizada! Su código de reserva es ${code}.`,
    pt: code => `Reserva concluída! O código da reserva é ${code}.`,
    ru: code => `Бронирование выполнено! Номер вашей заявки: ${code}.`,
    it: code => `Prenotazione completata! Il codice è ${code}.`,
    nl: code => `Boeking geslaagd! Uw boekingsnummer is ${code}.`,
    ar: code => `تم الحجز بنجاح! رقم الحجز هو ${code}.`,
    hi: code => `बुकिंग सफल हुई! आपका बुकिंग नंबर ${code} है।`,
    id: code => `Pemesanan berhasil! Kode pemesanan Anda adalah ${code}.`,
    ms: code => `Tempahan berjaya! Kod tempahan anda ialah ${code}.`,
    tl: code => `Matagumpay ang booking! Ang booking code mo ay ${code}.`,
    km: code => `ការកក់បានជោគជ័យ! លេខកូដកក់របស់អ្នកគឺ ${code}។`,
    lo: code => `ຈອງລົດສຳເລັດ! ລະຫັດການຈອງຂອງທ່ານແມ່ນ ${code}.`
};

function bookingSuccessMessage(language, code) {
    return (messages[language] || messages.vi)(code);
}

module.exports = { bookingSuccessMessage };
