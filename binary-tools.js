(function (root) {
    "use strict";

    function asBytes(input) {
        if (input instanceof Uint8Array) return input;
        if (input instanceof ArrayBuffer) return new Uint8Array(input);
        if (ArrayBuffer.isView(input)) {
            return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        }
        if (Array.isArray(input)) return Uint8Array.from(input);
        throw new TypeError("Expected an ArrayBuffer, typed array, or byte array");
    }

    function normalizeRange(bytes, start, end) {
        var from = start === undefined ? 0 : Number(start);
        var to = end === undefined ? bytes.length : Number(end);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > bytes.length) {
            throw new RangeError("Invalid byte range");
        }
        return [from, to];
    }

    function crc32(input, start, end) {
        var bytes = asBytes(input);
        var range = normalizeRange(bytes, start, end);
        var crc = 0xFFFFFFFF;
        for (var i = range[0]; i < range[1]; i += 1) {
            crc ^= bytes[i];
            for (var bit = 0; bit < 8; bit += 1) {
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
            }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function crc16Ccitt(input, start, end, initial) {
        var bytes = asBytes(input);
        var range = normalizeRange(bytes, start, end);
        var crc = initial === undefined ? 0xFFFF : Number(initial);
        if (!Number.isInteger(crc) || crc < 0 || crc > 0xFFFF) throw new RangeError("Initial CRC must fit uint16");
        for (var i = range[0]; i < range[1]; i += 1) {
            crc ^= bytes[i] << 8;
            for (var bit = 0; bit < 8; bit += 1) {
                crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xFFFF;
            }
        }
        return crc;
    }

    function byteSum(input, start, end, width) {
        var bytes = asBytes(input);
        var range = normalizeRange(bytes, start, end);
        var bits = width === undefined ? 8 : Number(width);
        if (![8, 16, 32].includes(bits)) throw new RangeError("Sum width must be 8, 16, or 32 bits");
        var sum = 0;
        for (var i = range[0]; i < range[1]; i += 1) sum = (sum + bytes[i]) >>> 0;
        return bits === 32 ? sum : sum & ((1 << bits) - 1);
    }

    function xorChecksum(input, start, end) {
        var bytes = asBytes(input);
        var range = normalizeRange(bytes, start, end);
        var result = 0;
        for (var i = range[0]; i < range[1]; i += 1) result ^= bytes[i];
        return result;
    }

    function findBytes(haystackInput, needleInput) {
        var haystack = asBytes(haystackInput);
        var needle = asBytes(needleInput);
        if (!needle.length) return [];
        var offsets = [];
        outer: for (var i = 0; i <= haystack.length - needle.length; i += 1) {
            for (var j = 0; j < needle.length; j += 1) {
                if (haystack[i + j] !== needle[j]) continue outer;
            }
            offsets.push(i);
        }
        return offsets;
    }

    function parseHexPattern(pattern) {
        if (typeof pattern !== "string") throw new TypeError("Hex pattern must be a string");
        var compact = pattern.trim().replace(/0x/gi, "").replace(/[\s,;:_-]+/g, "");
        if (!compact || compact.length % 2 !== 0 || !/^(?:[0-9a-fA-F?]{2})+$/.test(compact)) {
            throw new SyntaxError("Hex pattern must contain byte pairs; use ?? as a wildcard");
        }
        var result = [];
        for (var i = 0; i < compact.length; i += 2) {
            var token = compact.slice(i, i + 2);
            result.push(token === "??" ? null : parseInt(token, 16));
        }
        return result;
    }

    function searchHex(input, pattern) {
        var bytes = asBytes(input);
        var wanted = parseHexPattern(pattern);
        var offsets = [];
        outer: for (var i = 0; i <= bytes.length - wanted.length; i += 1) {
            for (var j = 0; j < wanted.length; j += 1) {
                if (wanted[j] !== null && bytes[i + j] !== wanted[j]) continue outer;
            }
            offsets.push(i);
        }
        return offsets;
    }

    function searchAscii(input, text, caseSensitive) {
        if (typeof text !== "string" || !text.length) return [];
        var bytes = asBytes(input);
        var needle = new TextEncoder().encode(text);
        if (caseSensitive !== false) return findBytes(bytes, needle);
        var foldedBytes = Uint8Array.from(bytes, function (value) {
            return value >= 65 && value <= 90 ? value + 32 : value;
        });
        var foldedNeedle = Uint8Array.from(needle, function (value) {
            return value >= 65 && value <= 90 ? value + 32 : value;
        });
        return findBytes(foldedBytes, foldedNeedle);
    }

    function numericBytes(value, width, endian, signed) {
        var byteWidth = Number(width);
        if (![1, 2, 4, 8].includes(byteWidth)) throw new RangeError("Numeric width must be 1, 2, 4, or 8 bytes");
        var little = endian === undefined || endian === "little";
        if (!little && endian !== "big") throw new TypeError("Endian must be 'little' or 'big'");
        var buffer = new ArrayBuffer(byteWidth);
        var view = new DataView(buffer);
        if (byteWidth === 8) {
            var big = typeof value === "bigint" ? value : BigInt(value);
            if (signed) view.setBigInt64(0, big, little);
            else view.setBigUint64(0, big, little);
        } else {
            var numeric = Number(value);
            if (!Number.isInteger(numeric)) throw new TypeError("Numeric search value must be an integer");
            var setter = (signed ? "setInt" : "setUint") + (byteWidth * 8);
            view[setter](0, numeric, little);
        }
        return new Uint8Array(buffer);
    }

    function searchNumeric(input, value, options) {
        var settings = options || {};
        return findBytes(input, numericBytes(value, settings.width || 4, settings.endian || "little", Boolean(settings.signed)));
    }

    function diff(leftInput, rightInput) {
        var left = asBytes(leftInput);
        var right = asBytes(rightInput);
        var length = Math.max(left.length, right.length);
        var differences = [];
        for (var i = 0; i < length; i += 1) {
            var leftValue = i < left.length ? left[i] : null;
            var rightValue = i < right.length ? right[i] : null;
            if (leftValue !== rightValue) differences.push({ offset: i, left: leftValue, right: rightValue, equal: false });
        }
        return { equal: differences.length === 0, differences: differences, leftLength: left.length, rightLength: right.length };
    }

    function resolveEnum(value, definitions, fallback) {
        if (!definitions || typeof definitions !== "object") throw new TypeError("Enum definitions must be an object");
        var key = String(value);
        return Object.prototype.hasOwnProperty.call(definitions, key)
            ? definitions[key]
            : (fallback === undefined ? value : fallback);
    }

    function resolveFlags(value, definitions) {
        if (!definitions || typeof definitions !== "object") throw new TypeError("Flag definitions must be an object");
        var numericValue = typeof value === "bigint" ? value : BigInt(value);
        var entries = Array.isArray(definitions)
            ? definitions.map(function (label, bit) { return [String(1n << BigInt(bit)), label]; })
            : Object.entries(definitions);
        return entries.reduce(function (matches, entry) {
            var mask = BigInt(entry[0]);
            if (mask !== 0n && (numericValue & mask) === mask) matches.push(entry[1]);
            return matches;
        }, []);
    }

    function slice(input, offset, length) {
        var bytes = asBytes(input);
        var start = Number(offset || 0);
        var size = length === undefined ? bytes.length - start : Number(length);
        if (!Number.isInteger(start) || !Number.isInteger(size) || start < 0 || size < 0 || start + size > bytes.length) {
            throw new RangeError("Invalid slice range");
        }
        return bytes.subarray(start, start + size);
    }

    function chunks(input, chunkSize) {
        var bytes = asBytes(input);
        var size = Number(chunkSize);
        if (!Number.isInteger(size) || size <= 0) throw new RangeError("Chunk size must be a positive integer");
        var result = [];
        for (var offset = 0; offset < bytes.length; offset += size) {
            result.push({ offset: offset, bytes: bytes.subarray(offset, Math.min(offset + size, bytes.length)) });
        }
        return result;
    }

    async function readBlobSlice(blob, offset, length) {
        if (!blob || typeof blob.slice !== "function") throw new TypeError("Expected a Blob or File");
        var start = Number(offset || 0);
        var size = length === undefined ? blob.size - start : Number(length);
        if (!Number.isInteger(start) || !Number.isInteger(size) || start < 0 || size < 0 || start + size > blob.size) {
            throw new RangeError("Invalid Blob slice range");
        }
        return new Uint8Array(await blob.slice(start, start + size).arrayBuffer());
    }

    async function forEachBlobChunk(blob, chunkSize, callback) {
        if (typeof callback !== "function") throw new TypeError("Chunk callback must be a function");
        var size = Number(chunkSize);
        if (!Number.isInteger(size) || size <= 0) throw new RangeError("Chunk size must be a positive integer");
        for (var offset = 0; offset < blob.size; offset += size) {
            var bytes = await readBlobSlice(blob, offset, Math.min(size, blob.size - offset));
            await callback(bytes, offset, blob.size);
        }
    }

    root.BinaryTools = Object.freeze({
        asBytes: asBytes,
        crc32: crc32,
        crc16Ccitt: crc16Ccitt,
        byteSum: byteSum,
        xorChecksum: xorChecksum,
        searchHex: searchHex,
        searchAscii: searchAscii,
        searchNumeric: searchNumeric,
        diff: diff,
        resolveEnum: resolveEnum,
        resolveFlags: resolveFlags,
        slice: slice,
        chunks: chunks,
        readBlobSlice: readBlobSlice,
        forEachBlobChunk: forEachBlobChunk
    });
}(typeof window !== "undefined" ? window : globalThis));
