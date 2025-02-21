# Anlık Mesajlaşma ve WebRTC Sesli Görüşme Uygulaması (Python Backend)

Bu proje, Python backend ve HTML, CSS, JS kullanarak geliştirilmiş bir anlık mesajlaşma ve **WebRTC** tabanlı **sesli görüşme** uygulamasıdır. Kullanıcılar anlık olarak mesajlaşabilir ve sesli görüşmeler yapabilirler.

## Özellikler

- **Kullanıcı Kaydı ve Girişi:** Kullanıcılar hesap oluşturabilir ve giriş yapabilir.
- **WebRTC ile Sesli Görüşme:** WebRTC teknolojisi ile sesli görüşme başlatılabilir.
- **Cevap Verme ve Görüşme Başlatma:** Kullanıcılar bir görüşme teklifini kabul edebilir ve kendi görüşmelerini başlatabilirler.
- **Online Kullanıcı Listesi:** Sistemdeki aktif kullanıcılar listelenebilir.

## Teknolojiler

- **Frontend:**
  - HTML
  - CSS
  - JavaScript (AJAX, WebRTC)
  
- **Backend:**
  - **Python**
  - **Flask** (Web framework)
  - **Flask-SocketIO** (Gerçek zamanlı bağlantılar için)
  - **eventlet** (Asenkron işlem yönetimi.)

## Kurulum

### 1. Projeyi Kendi Bilgisayarınıza Klonlayın

```bash
git clone https://github.com/username/project-name.git
cd project-name
