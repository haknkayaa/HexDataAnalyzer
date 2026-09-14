(function (global) {
    'use strict';

    function fail(message) {
        throw new Error(message);
    }

    function asBytes(value, label) {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        }
        if (Array.isArray(value)) return Uint8Array.from(value);
        fail((label || 'Veri') + ' byte dizisi olmalıdır.');
    }

    function parseHexText(text) {
        var source = String(text == null ? '' : text).trim();
        var compact = source.replace(/(?:0x)?([0-9a-f]{2})/gi, '$1').replace(/[\s,;:_-]/g, '');

        if (!compact.length) return new Uint8Array(0);
        if (/[^0-9a-f]/i.test(compact)) fail('Hex girdisi geçersiz karakter içeriyor.');
        if (compact.length % 2) fail('Hex girdisi tam byte içermeli; son hane eşleşmiyor.');

        var bytes = new Uint8Array(compact.length / 2);
        for (var index = 0; index < compact.length; index += 2) {
            bytes[index / 2] = parseInt(compact.slice(index, index + 2), 16);
        }
        return bytes;
    }

    function bytesToHex(value, separator) {
        var bytes = asBytes(value);
        var joiner = separator === undefined ? ' ' : String(separator);
        return Array.from(bytes, function (byte) {
            return byte.toString(16).padStart(2, '0').toUpperCase();
        }).join(joiner);
    }

    function normalizeHex(text, separator) {
        return bytesToHex(parseHexText(text), separator);
    }

    function base64ToBytes(text) {
        var compact = String(text == null ? '' : text).replace(/\s/g, '');
        if (!compact.length) return new Uint8Array(0);
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
            fail('Base64 girdisi geçersiz.');
        }

        var decoded;
        try {
            decoded = global.atob(compact);
        } catch (error) {
            fail('Base64 girdisi çözümlenemedi.');
        }
        var bytes = new Uint8Array(decoded.length);
        for (var index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
        return bytes;
    }

    function asciiToBytes(text) {
        var source = String(text == null ? '' : text);
        var bytes = new Uint8Array(source.length);
        for (var index = 0; index < source.length; index += 1) {
            var code = source.charCodeAt(index);
            if (code > 0x7f) fail('ASCII girdisi yalnızca 0–127 aralığındaki karakterleri içerebilir.');
            bytes[index] = code;
        }
        return bytes;
    }

    function ensureRange(total, offset, length, label) {
        if (offset < 0 || length < 0 || offset + length > total) {
            fail((label || 'Dosya') + ' kesik veya bozuk görünüyor.');
        }
    }

    function parsePcap(value) {
        var bytes = asBytes(value, 'PCAP');
        ensureRange(bytes.length, 0, 24, 'PCAP üst bilgisi');
        var magic = bytesToHex(bytes.subarray(0, 4), '');
        var littleEndian;
        if (magic === 'D4C3B2A1' || magic === '4D3CB2A1') littleEndian = true;
        else if (magic === 'A1B2C3D4' || magic === 'A1B23C4D') littleEndian = false;
        else fail('Desteklenmeyen PCAP biçimi veya magic değeri.');

        var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var packets = [];
        var offset = 24;
        while (offset < bytes.length) {
            ensureRange(bytes.length, offset, 16, 'PCAP paket üst bilgisi');
            var capturedLength = view.getUint32(offset + 8, littleEndian);
            ensureRange(bytes.length, offset + 16, capturedLength, 'PCAP paket verisi');
            packets.push(bytes.slice(offset + 16, offset + 16 + capturedLength));
            offset += 16 + capturedLength;
        }
        return packets;
    }

    function parsePcapNg(value) {
        var bytes = asBytes(value, 'PCAP-NG');
        var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var packets = [];
        var offset = 0;
        var littleEndian = true;

        while (offset < bytes.length) {
            ensureRange(bytes.length, offset, 12, 'PCAP-NG blok üst bilgisi');
            var isSection = bytes[offset] === 0x0a && bytes[offset + 1] === 0x0d &&
                bytes[offset + 2] === 0x0d && bytes[offset + 3] === 0x0a;
            if (isSection) {
                ensureRange(bytes.length, offset, 28, 'PCAP-NG Section Header Block');
                var bom = bytesToHex(bytes.subarray(offset + 8, offset + 12), '');
                if (bom === '4D3C2B1A') littleEndian = true;
                else if (bom === '1A2B3C4D') littleEndian = false;
                else fail('PCAP-NG byte-order magic değeri geçersiz.');
            } else if (offset === 0) {
                fail('PCAP-NG dosyası Section Header Block ile başlamalıdır.');
            }

            var blockType = isSection ? 0x0a0d0d0a : view.getUint32(offset, littleEndian);
            var blockLength = view.getUint32(offset + 4, littleEndian);
            if (blockLength < 12 || blockLength % 4 !== 0) fail('PCAP-NG blok uzunluğu geçersiz.');
            ensureRange(bytes.length, offset, blockLength, 'PCAP-NG bloğu');
            if (view.getUint32(offset + blockLength - 4, littleEndian) !== blockLength) {
                fail('PCAP-NG blok uzunluğu doğrulaması başarısız.');
            }

            if (blockType === 0x00000006) {
                if (blockLength < 32) fail('PCAP-NG Enhanced Packet Block çok kısa.');
                var enhancedLength = view.getUint32(offset + 20, littleEndian);
                ensureRange(offset + blockLength - 4, offset + 28, enhancedLength, 'PCAP-NG paket verisi');
                packets.push(bytes.slice(offset + 28, offset + 28 + enhancedLength));
            } else if (blockType === 0x00000003) {
                if (blockLength < 16) fail('PCAP-NG Simple Packet Block çok kısa.');
                var originalLength = view.getUint32(offset + 8, littleEndian);
                var storedLength = Math.min(originalLength, blockLength - 16);
                packets.push(bytes.slice(offset + 12, offset + 12 + storedLength));
            } else if (blockType === 0x00000002) {
                if (blockLength < 32) fail('PCAP-NG Packet Block çok kısa.');
                var capturedLength = view.getUint32(offset + 20, littleEndian);
                ensureRange(offset + blockLength - 4, offset + 28, capturedLength, 'PCAP-NG paket verisi');
                packets.push(bytes.slice(offset + 28, offset + 28 + capturedLength));
            }
            offset += blockLength;
        }
        return packets;
    }

    function extractPackets(value) {
        var bytes = asBytes(value);
        var magic = bytes.length >= 4 ? bytesToHex(bytes.subarray(0, 4), '') : '';
        if (magic === '0A0D0D0A') return parsePcapNg(bytes);
        return parsePcap(bytes);
    }

    function splitFrames(value, magicValue) {
        var bytes = asBytes(value);
        var magic = typeof magicValue === 'string' ? parseHexText(magicValue) : asBytes(magicValue, 'Magic');
        if (!magic.length) fail('Frame ayırmak için en az bir magic byte gereklidir.');

        var starts = [];
        for (var offset = 0; offset <= bytes.length - magic.length; offset += 1) {
            var matches = true;
            for (var index = 0; index < magic.length; index += 1) {
                if (bytes[offset + index] !== magic[index]) { matches = false; break; }
            }
            if (matches) starts.push(offset);
        }
        return starts.map(function (start, index) {
            return bytes.slice(start, index + 1 < starts.length ? starts[index + 1] : bytes.length);
        });
    }

    async function readFile(file) {
        if (!file || typeof file.arrayBuffer !== 'function') fail('Geçerli bir dosya seçilmedi.');
        var name = String(file.name || '');
        var extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
        var raw = new Uint8Array(await file.arrayBuffer());

        if (extension === 'pcap' || extension === 'pcapng' || /pcap/i.test(file.type || '')) {
            return extractPackets(raw);
        }
        if (extension === 'hex' || extension === 'txt' || /^text\//i.test(file.type || '')) {
            var text = typeof file.text === 'function' ? await file.text() : new TextDecoder().decode(raw);
            return parseHexText(text);
        }
        if (extension === 'bin' || extension === 'dat' || !extension || file.type === 'application/octet-stream') {
            return raw;
        }
        fail('Desteklenmeyen dosya türü: .' + extension + '. .bin, .dat, .hex, .txt, .pcap ve .pcapng kullanın.');
    }

    function initDropZone(options) {
        options = options || {};
        var target = options.target;
        if (!target || typeof target.addEventListener !== 'function') fail('Geçerli bir drop-zone hedefi gerekli.');
        if (typeof options.onBytes !== 'function') fail('onBytes callback fonksiyonu gerekli.');
        var onError = typeof options.onError === 'function' ? options.onError : function (error) { console.error(error); };

        function prevent(event) { event.preventDefault(); }
        async function drop(event) {
            event.preventDefault();
            var files = event.dataTransfer && event.dataTransfer.files;
            if (!files || !files.length) return onError(new Error('Bırakılan öğede dosya bulunamadı.'));
            try {
                var result = await readFile(files[0]);
                options.onBytes(result, { file: files[0], packets: Array.isArray(result) });
            } catch (error) {
                onError(error);
            }
        }
        target.addEventListener('dragenter', prevent);
        target.addEventListener('dragover', prevent);
        target.addEventListener('drop', drop);

        return function destroy() {
            target.removeEventListener('dragenter', prevent);
            target.removeEventListener('dragover', prevent);
            target.removeEventListener('drop', drop);
        };
    }

    global.HexInputTools = Object.freeze({
        parseHexText: parseHexText,
        normalizeHex: normalizeHex,
        base64ToBytes: base64ToBytes,
        asciiToBytes: asciiToBytes,
        bytesToHex: bytesToHex,
        parsePcap: parsePcap,
        parsePcapNg: parsePcapNg,
        extractPackets: extractPackets,
        readFile: readFile,
        splitFrames: splitFrames,
        initDropZone: initDropZone
    });
}(typeof window !== 'undefined' ? window : globalThis));
