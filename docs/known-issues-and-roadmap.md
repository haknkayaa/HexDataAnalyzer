# Hex Data Analyzer — Açık Sorunlar ve Geliştirme Yol Haritası

Bu dosya yalnızca henüz tamamlanmamış veya kısmen tamamlanmış işleri içerir. Çözülen maddeler listeden kaldırılır.

## P1 — Analiz özellikleri

### 1. Enum ve flag editörü eksik

- **Durum:** Kısmen tamamlandı
- Enum/flag çözümleme motoru mevcut, ancak alan tanımı arayüzünden eşleme düzenleme henüz yok.

### 2. UTF-8 metin alanı yok

- **Durum:** Açık
- Tek byte `char`, ASCII ve ham hex çalışıyor. Çok byte'lı UTF-8 için `TextDecoder` tabanlı alan türü ve hata politikası eklenmeli.

### 3. Koşullu ve dinamik alanların arayüz entegrasyonu eksik

- **Durum:** Kısmen tamamlandı
- Schema motoru `when` ve `lengthFrom` ifadelerini güvenli biçimde çözebiliyor. Bu tanımların ana alan tablosundan düzenlenmesi ve analiz sonucuna otomatik uygulanması tamamlanmalı.

### 4. Büyük dosya görünümü sanallaştırılmıyor

- **Durum:** Kısmen tamamlandı
- Parçalı `Blob/File` okuma yardımcıları mevcut. Hex görünümünün tamamını DOM'a basmak yerine sanallaştırılmış/paged rendering uygulanmalı.

## P2 — Kod kalitesi ve sürdürülebilirlik

### 5. Uygulama durumu DOM'dan tekrar okunuyor

- **Durum:** Açık
- Alan listesi her analizde tablodan tekrar kuruluyor. Hex byte'ları ve alan tanımları için tek bir state modeli oluşturulmalı.

### 6. Ana controller hâlâ birden fazla sorumluluk taşıyor

- **Durum:** Kısmen tamamlandı
- Dosya, schema ve binary yardımcıları bağımsız modüllere ayrıldı. Alan dönüşümü, state ve DOM çizimi de ayrı modüllere taşınmalı.

### 7. Kalıcı otomatik test altyapısı yok

- **Durum:** Açık
- Geliştirme sırasında smoke ve tarayıcı testleri çalıştırılıyor, ancak repoda tekrar çalıştırılabilir test komutu bulunmuyor.

### 8. Satır içi stiller ve olay işleyicileri var

- **Durum:** Açık
- Dinamik kontrollerdeki stiller CSS sınıflarına, inline olaylar event delegation yapısına taşınmalı.

### 9. Harici font bağımlılığı var

- **Durum:** Açık
- DM Mono ve Manrope Google Fonts üzerinden yükleniyor. Tam çevrimdışı kullanım için fontlar yerelleştirilmeli veya sistem fontları kullanılmalı.

## Önerilen çözüm sırası

1. Kalıcı test altyapısı ve analiz motorunun DOM'dan ayrılması.
2. Enum/flag ve conditional/dynamic schema arayüzü.
3. UTF-8 alan türü.
4. Büyük dosya için sanallaştırılmış hex görünümü.
5. Merkezi state, inline handler temizliği ve harici fontların kaldırılması.
