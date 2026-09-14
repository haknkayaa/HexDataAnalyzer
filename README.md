# Hexscope — Hex Data Analyzer

Tarayıcıda çalışan, ham hex verisini byte aralıklarına ayırıp renklerle görselleştiren ve seçilen alanları farklı veri türlerinde yorumlayan hafif bir analiz aracıdır. Kurulum, hesap veya sunucu gerektirmez; bütün işlem kullanıcının tarayıcısında gerçekleşir.

**Canlı demo:** [haknkayaa.github.io/HexDataAnalyzer](https://haknkayaa.github.io/HexDataAnalyzer/)

[![Hexscope ekran görüntüsü](images/Capture.PNG)](https://haknkayaa.github.io/HexDataAnalyzer/)

## Neler yapabilir?

- Boşluklu veya bitişik hex girdisini otomatik olarak byte biçimine getirir.
- Geçersiz karakterleri, yarım byte girdisini ve veri dışına taşan alan aralıklarını bildirir.
- Drag & drop veya dosya seçiciyle `.bin`, `.dat`, `.hex`, `.txt`, `.pcap` ve `.pcapng` açar.
- Hex, Base64 ve ASCII girdilerini byte dizisine dönüştürür.
- Sayısal alanlar için big-endian/little-endian seçimi sunar.
- Alanları başlangıç dahil, bitiş hariç `[start, end)` byte indeksleriyle tanımlar.
- Her alanı ayrı renkle işaretler; hex görünümü ile alan listesini görsel olarak eşleştirir.
- Ana alanların içinde byte veya bit tabanlı alt alanlar oluşturur.
- Dönüştürülen değeri değiştirerek desteklenen alanları tekrar ham byte dizisine yazabilir.
- Alan tanımlarını JSON olarak içe ve dışa aktarır.
- Biçimlendirilmiş hex dökümünü ve alan sonuçlarını panoya kopyalar.
- Hex/ASCII/sayısal değer arama, CRC32, CRC16-CCITT, SUM8 ve XOR checksum hesaplama sunar.
- Magic byte dizisine göre frame ayırır ve ikinci bir dosyayla binary diff yapar.
- Schema'yı JSON/YAML olarak dışa aktarır veya URL hash'i içinde paylaşır.
- Çözümlenen alanları JSON/CSV olarak dışa aktarır.
- Hazır, genel amaçlı presetlerle örnek verileri tek tıkla yükler.
- Masaüstü ve dar ekranlarda çalışır.

## Kullanım

1. **Ham hex verisi** alanına verinizi yapıştırın, dosyayı giriş paneline bırakın, **Dosya aç** ile desteklenen bir dosya seçin veya listeden preset yükleyin.
2. **Alan ekle** ile bir alan oluşturun.
3. Alan adı, renk, başlangıç/bitiş byte indeksleri ve veri türünü belirleyin.
4. Sonucu hem **Dönüştürülen değer** sütununda hem de renkli **İnceleme görünümü** içinde takip edin.
5. Aynı düzeni daha sonra kullanmak için **Dışa aktar** ile alan tanımlarını kaydedin.

Örneğin `48 65 6C 6C 6F` girdisinde `0–5` aralığını `ascii` olarak tanımlamak `Hello` sonucunu üretir.

> PCAP/PCAP-NG desteği paket byte'larını çıkarır ve ilk paketi inceleme alanında açar. TCP stream birleştirme ve Wireshark seviyesinde protokol çözümleme yapmaz.

## Desteklenen veri türleri

| Grup | Türler |
| --- | --- |
| Tam sayılar | `uint8`, `uint16`, `uint32`, `uint64`, `int8`, `int16`, `int32`, `int64` |
| Ondalıklı sayılar | IEEE 754 `float` (32-bit), `double` (64-bit) |
| Metin ve ham gösterim | `char`, `ascii`, `hex`, `bits` |
| Ağ ve zaman yardımcıları | `mac`, `ipv4`, `protocol`, `udpLength`, `epochUtc` |
| Bileşik alan | `custom` ile byte/bit tabanlı alt alanlar |

64-bit tam sayılar hassasiyet kaybını önlemek için `BigInt` tabanlı olarak işlenir. `char` tek byte, `float` 4 byte ve `double` 8 byte alan bekler.

## Public presetler

Repo yalnızca genel ve sentetik örnekler içerir:

- ASCII metin
- Sensör paketi
- Mesaj başlığı
- Ethernet · IPv4 · UDP
- Ethernet · IPv4 · TCP
- IPv4 başlığı
- Sayısal veri türleri
- Zaman damgalı kayıt
- Bit alanları ve durum
- TLV mesajı
- Base64 giriş örneği
- Düz metin giriş örneği

Güncel katalog [`presets/index.json`](presets/index.json) dosyasında tutulur. Her public preset bağımsız bir JSON dosyasıdır. Yeni bir preset eklerken:

1. Tanımı `presets/` altında oluşturun.
2. Dosyayı `presets/index.json` manifestine ekleyin.

Public presetlerde yalnızca genel, sentetik ve paylaşılması güvenli örnekler kullanılmalıdır.

### Örnek veri dosyaları

`Dosya aç` ve drag & drop akışını denemek için [`presets/examples`](presets/examples) altında paylaşılması güvenli sentetik dosyalar bulunur:

- [`sample.hex`](presets/examples/sample.hex) — boşlukla ayrılmış hex metni
- [`sample.txt`](presets/examples/sample.txt) — TXT dosyası içinde hex dump
- [`sample.dat`](presets/examples/sample.dat) — ham byte olarak okunan DAT örneği
- [`sample.bin`](presets/examples/sample.bin) — ham byte olarak okunan BIN örneği

## Alan tanımlarını içe ve dışa aktarma

**Dışa aktar**, mevcut alan düzenini `hexscope-fields.json` olarak indirir. Dosya; etiket, renk, byte aralığı, veri türü ve varsa alt alanları içerir. Ham hex veri bu dosyaya eklenmez.

**İçe aktar**, uygulamanın dışa aktardığı nesne biçimini veya doğrudan bir alan dizisini kabul eder:

```json
{
  "format": "hexscope-field-definitions",
  "version": 1,
  "fields": [
    {
      "label": "Mesaj kodu",
      "color": "#60a5fa",
      "startIndex": 0,
      "endIndex": 2,
      "dataType": "uint16",
      "children": []
    }
  ]
}
```

Alan tanımları JSON yanında güvenli YAML alt kümesiyle de taşınabilir. Schema paylaşım bağlantısı yalnızca alan şemasını URL hash'ine gömer; incelenen binary veri bağlantıya eklenmez.

## Yerel çalıştırma

Proje derleme adımı veya paket yöneticisi gerektirmeyen statik bir web uygulamasıdır.

En kolay yöntem, repo klasöründe küçük bir HTTP sunucusu başlatmaktır:

```bash
python3 -m http.server 8000
```

Ardından [http://localhost:8000](http://localhost:8000) adresini açın. Tarayıcı güvenlik modeli ve JSON preset yükleme davranışı nedeniyle `index.html` dosyasını `file://` ile doğrudan açmak desteklenmez.

## GitHub Pages

Uygulama tüm kendi kaynaklarında göreli yollar kullandığı için proje sitesi olarak `/HexDataAnalyzer/` alt yolunda çalışır. Yayınlamak için GitHub deposunda **Settings → Pages** bölümünden uygun dalı ve kök klasörü seçin. `index.html`, `controller.js`, `style.css`, `presets/` ve `images/` dizinlerinin yayınlanan dalda bulunduğundan emin olun.

Canlı sürümün adresi:

```text
https://haknkayaa.github.io/HexDataAnalyzer/
```

## Güvenlik ve gizlilik

- Hex verisi ve alan tanımları analiz için bir sunucuya gönderilmez; işlem istemci tarafında yapılır.
- Seçilen `.bin`, `.hex` ve `.txt` dosyaları yalnızca tarayıcı belleğinde okunur; GitHub Pages'e veya başka bir sunucuya yüklenmez.
- Uygulama public repoda şirkete, müşteriye veya kapalı bir protokole ait preset ve örnek veri barındırmamalıdır.
- Gerçek paket dökümleri, ağ adresleri, anahtarlar ve kurum içi şemalar commit edilmemelidir.
- Yerel/özel preset dosyaları sürüm kontrolü dışında tutulmalıdır; paylaşmadan önce `git status` ve repo içeriği kontrol edilmelidir.
- Sayfa yazı tipleri için Google Fonts'a bağlantı kurar. Tamamen çevrimdışı kullanım hedefleniyorsa bu bağımlılığın yerelleştirilmesi gerekir.

## Yol haritası

Mevcut uygulama dosya/girdi dönüşümü, endianness, byte/bit alanları, JSON/YAML schema, URL paylaşımı, arama, checksum, frame splitting ve binary diff için çalışan bir temel sunar. UTF-8, tam enum/flag editörü, büyük dosya sanallaştırması, gelişmiş koşullu schema arayüzü, C struct içe aktarma ve VS Code eklentisi sonraki hedeflerdir.

- [Bilinen sorunlar ve geliştirme durumu](docs/known-issues-and-roadmap.md)
- [Binary Protocol Inspector v2 yol haritası](docs/roadmap.md)

## Teknik yapı

```text
index.html          Arayüz ve erişilebilir HTML yapısı
controller.js       Ayrıştırma, dönüşüm ve etkileşim mantığı
input-tools.js      Dosya, PCAP, girdi biçimi ve frame ayırma araçları
schema-tools.js     JSON/YAML schema, URL paylaşımı ve çıktı araçları
binary-tools.js     CRC/checksum, arama, diff ve büyük dosya yardımcıları
style.css           Responsive görünüm
presets/            GitHub Pages üzerinden yüklenen public presetler
docs/               Bilinen sorunlar ve v2 planları
```

## Katkı

Hata bildirirken örnek girdiyi mümkünse sentetikleştirin ve beklenen/gerçek sonucu açıkça yazın. Yeni bir veri türü veya preset eklerken sınır durumlarını, gerekli byte uzunluğunu ve public paylaşım açısından güvenli olduğunu da kontrol edin.
