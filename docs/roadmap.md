# Hex Data Analyzer v2 — Binary Protocol Inspector Roadmap

Bu yol haritasının amacı mevcut hex analiz aracını, genel amaçlı bir binary protokol inceleme aracına ve ilerleyen aşamada bir VS Code eklentisine dönüştürmektir.

Ürün; şirkete, müşteriye veya kapalı bir protokole ait hazır veri ve şemalar içermeyecektir. Kullanıcıların oluşturduğu özel şemalar yalnızca kendi çalışma alanlarında saklanacaktır.

## Ürün vizyonu

Kullanıcı bir hex metni, binary dosya veya clipboard içeriği açar; araç seçilen şemayı kullanarak veriyi alanlara ayırır, değerleri dönüştürür ve ilgili byte aralıklarını renklerle eşleştirir.

```text
Offset   Size   Field          Type       Value
0x0000      4   magic          ascii      DEMO
0x0004      4   timestamp      uint32     1989685818
0x0008      1   messageId      uint8      10
0x0009      2   payloadLength  uint16     192
0x000B      1   status         enum       Success
```

## Aşama 1 — Güvenilir analiz çekirdeği

Öncelik: P0

- Hex girdisini doğrulama ve tek biçime dönüştürme.
- Byte aralıklarını `[start, end)` kuralıyla doğrulama.
- Global ve alan bazlı `little-endian` / `big-endian` desteği.
- `uint8/16/32/64` ve `int8/16/32/64` türleri.
- IEEE 754 `float32` ve `float64` dönüşümleri.
- `bool`, `ascii`, UTF-8 ve ham `bytes` türleri.
- 64-bit değerleri hassasiyet kaybı olmadan gösterme.
- Offsetleri decimal ve hexadecimal biçimde gösterme.
- Parser ve dönüşüm motorunu DOM kodundan ayırma.
- Temel dönüşümler için otomatik birim testleri.

Başarı ölçütü: Aynı veri ve şema, arayüzden bağımsız analiz motorunda deterministik ve test edilmiş bir sonuç üretir.

## Aşama 2 — Şema tabanlı protokoller

Öncelik: P0

Manuel başlangıç ve bitiş indeksleri korunacak; ancak ana kullanım şekli YAML veya JSON şeması olacaktır.

```yaml
name: TelemetryFrame
endian: little

fields:
  - name: magic
    type: ascii
    length: 4

  - name: timestamp
    type: uint32

  - name: messageId
    type: uint8

  - name: payloadLength
    type: uint16

  - name: payload
    type: bytes
    lengthFrom: payloadLength

  - name: checksum
    type: uint16
```

- YAML ve JSON şema içe/dışa aktarma.
- Alan offsetlerini önceki alanların boyutundan otomatik hesaplama.
- Sabit uzunluklu diziler.
- Başka bir alandan uzunluk alan dinamik diziler (`lengthFrom`).
- İç içe yapılar (`struct`) ve yeniden kullanılabilir tipler.
- Enum değerleri ve kullanıcı dostu açıklamalar.
- Bitfield ve flag tanımları.
- Magic/header doğrulaması.
- Şema hatalarında alan ve satır konumunu belirten mesajlar.
- Şema sürümü ve geriye dönük uyumluluk politikası.

Başarı ölçütü: Kullanıcı başlangıç/bitiş indeksi girmeden, yalnızca bir şema seçerek örnek paketi tamamen çözümleyebilir.

## Aşama 3 — Dosya ve çalışma akışı

Öncelik: P1

- `.bin` ve diğer ham binary dosyaları açma.
- Hex metin dosyası ve clipboard içeriği alma.
- Büyük dosyalarda sayfalama veya sanallaştırılmış hex görünümü.
- Offsete gitme, alan adına göre arama ve seçimi senkronize etme.
- Hex görünümü ile alan tablosu arasında çift yönlü highlight.
- Paket/preset kaydetme ve tekrar açma.
- Son kullanılan şemaları hatırlama.
- Decode edilen sonucu JSON veya CSV olarak dışa aktarma.
- Açık ve anlaşılır boş, yükleniyor ve hata durumları.

Başarı ölçütü: Kullanıcı gerçek bir binary dosyayı açıp ilgili şemayla inceleyebilir ve sonucu dışa aktarabilir.

## Aşama 4 — Bütünlük kontrolleri

Öncelik: P1

- Yaygın CRC türleri için doğrulama desteği.
- Toplam, XOR ve benzeri checksum yöntemleri.
- Başlangıç offseti, kapsanan aralık, polynomial ve initial value seçenekleri.
- Beklenen ve hesaplanan değeri birlikte gösterme.
- Hatalı magic, uzunluk, CRC ve checksum değerlerini görünür biçimde işaretleme.

Not: İlk sürüm yalnızca açıkça tanımlanan standart algoritmaları içermeli; kuruma özel algoritmalar uygulama reposuna eklenmemelidir.

## Aşama 5 — C struct içe aktarma

Öncelik: P2

- Temel `typedef struct` tanımlarını şemaya dönüştürme.
- Sabit genişlikli C türlerini (`uint8_t`, `uint16_t`, `uint32_t` vb.) tanıma.
- Sabit boyutlu array ve iç içe struct desteği.
- `packed` yapıların işlenmesi.
- Platforma bağlı hizalama ve padding için açık uyarılar.
- Pointer, union, bitfield ve makrolar için destek sınırlarını anlaşılır biçimde gösterme.
- Oluşturulan şemayı kullanıcı onayından önce önizleme.

Başarı ölçütü: Desteklenen, basit ve packed bir C struct güvenli şekilde içe aktarılıp düzenlenebilir bir şemaya dönüşür.

## Aşama 6 — VS Code eklentisi

Öncelik: P1

- Binary dosyalar için özel editor görünümü.
- Komut paletinden `Open with Binary Protocol Inspector` komutu.
- Çalışma alanındaki şemaları keşfetme ve seçme.
- Webview içinde hex görünümü, alan tablosu ve detay paneli.
- Dosya değiştiğinde yeniden analiz.
- Seçili byte aralığını kopyalama ve editöre geri yazma.
- Workspace ayarlarında varsayılan endian ve şema klasörü.
- Web uygulamasıyla ortak analiz motoru ve ortak testler.
- Özel şemaları workspace içinde tutma ve varsayılan olarak versiyon kontrolüne eklememe seçeneği.

Başarı ölçütü: Kullanıcı VS Code’dan ayrılmadan binary dosya açabilir, şema seçebilir ve byte/alan eşleşmelerini inceleyebilir.

## Aşama 7 — İleri seviye özellikler

Öncelik: P2

- Koşullu alanlar (`when`).
- Discriminator değerine göre farklı paket yapıları.
- Değişken uzunluklu integer ve null-terminated string.
- Birden fazla paketi stream içinden ayırma.
- İki binary dosya veya paket arasında alan bazlı diff.
- Şemadan örnek veri üretme.
- Decode edilmiş değerleri düzenleyip tekrar binary oluşturma.
- Extension API ile kullanıcı tanımlı decoder/validator desteği.

## Önerilen teslim sırası

1. Analiz motoru, doğrulama, temel türler ve endianness.
2. YAML/JSON şema modeli ve şema editörü.
3. Binary dosya açma ve büyük veri görünümü.
4. VS Code eklentisinin okunabilir ilk sürümü.
5. CRC/checksum ve gelişmiş doğrulamalar.
6. C struct import.
7. Düzenleme, yeniden encode etme ve eklenti API'si.

## İlk sürümün kapsamı

İlk yayın için önerilen dar kapsam:

- Hex metin ve `.bin` dosyası açma.
- YAML/JSON şema yükleme.
- Temel integer, float, bool, ascii ve bytes türleri.
- Little/big endian.
- Sabit array, enum ve bitfield.
- Offset/size/value tablosu.
- Senkronize renkli hex highlight.
- Şema ve analiz sonucunu dışa aktarma.

Nested struct, dinamik array, CRC, C struct import ve binary düzenleme sonraki sürümlere bırakılabilir.

## Ürün sınırları ve güvenlik

- Public repoda gerçek kurum, müşteri, cihaz veya kapalı protokol adları kullanılmamalıdır.
- Gerçek paket dump'ları, ağ adresleri, anahtarlar ve şirkete özel alan tanımları örnek veriye eklenmemelidir.
- Dokümantasyon ve testlerde yalnızca sentetik, genel amaçlı veri kullanılmalıdır.
- Workspace şemaları kullanıcı açıkça istemedikçe ağ üzerinden gönderilmemelidir.
- C struct import ve kullanıcı decoder'ları güvenilmeyen kod çalıştırmamalı; yalnızca güvenli ayrıştırma kullanılmalıdır.

## Açık ürün kararları

- Web uygulaması v2 ile VS Code eklentisi aynı monorepo içinde mi tutulacak?
- Ana şema biçimi YAML mı JSON mı olacak?
- Şema dosyaları için uzantı `.binary-schema.yaml` gibi özel bir biçim mi kullanacak?
- İlk extension sürümü yalnızca read-only mi olacak?
- CRC algoritmaları çekirdekte mi bulunacak, yoksa eklenti sistemiyle mi sağlanacak?
