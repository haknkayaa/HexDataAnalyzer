(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.HexSchemaTools = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var DEFAULT_COLOR = '#94a3b8';
    var SAFE_TYPES = [
        'uint8', 'uint16', 'uint32', 'uint64', 'int8', 'int16', 'int32', 'int64',
        'float', 'double', 'char', 'ascii', 'hex', 'bits', 'bytes', 'bool', 'custom',
        'epochUtc', 'mac', 'ipv4', 'protocol', 'udpLength'
    ];

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function integer(value, fallback) {
        var number = Number(value);
        return Number.isInteger(number) ? number : fallback;
    }

    function normalizeWhen(when) {
        if (!isObject(when) || typeof when.field !== 'string' || !when.field.trim() || !Object.prototype.hasOwnProperty.call(when, 'equals')) return undefined;
        return { field: when.field.trim(), equals: when.equals };
    }

    function normalizeField(field, index) {
        field = isObject(field) ? field : {};
        var offset = integer(field.offset, integer(field.startIndex, undefined));
        var end = integer(field.endIndex, undefined);
        var length = integer(field.length, offset !== undefined && end !== undefined ? end - offset : undefined);
        var result = {
            name: String(field.name !== undefined ? field.name : (field.label !== undefined ? field.label : 'field_' + index)),
            type: String(field.type !== undefined ? field.type : (field.dataType !== undefined ? field.dataType : 'hex')),
            color: typeof field.color === 'string' && field.color ? field.color : DEFAULT_COLOR
        };
        if (offset !== undefined) result.offset = offset;
        if (length !== undefined) result.length = length;
        if (field.scope === 'bit' || field.scope === 'byte') result.scope = field.scope;
        if (typeof field.lengthFrom === 'string' && field.lengthFrom.trim()) result.lengthFrom = field.lengthFrom.trim();
        var when = normalizeWhen(field.when);
        if (when) result.when = when;
        if (Array.isArray(field.children)) result.children = field.children.map(normalizeField);
        return result;
    }

    function normalizeSchema(input) {
        if (!isObject(input)) throw new TypeError('Schema bir nesne olmalıdır.');
        var result = {
            version: integer(input.version, 1),
            name: String(input.name || 'Adsız şema'),
            endian: input.endian === 'big' ? 'big' : 'little',
            fields: Array.isArray(input.fields) ? input.fields.map(normalizeField) : []
        };
        return result;
    }

    function validateSchema(input) {
        var errors = [];
        var schema;
        try { schema = normalizeSchema(input); } catch (error) {
            return { valid: false, errors: [error.message], schema: null };
        }
        function inspect(fields, path) {
            fields.forEach(function (field, index) {
                var here = path + '[' + index + ']';
                if (!field.name.trim()) errors.push(here + '.name boş olamaz.');
                if (SAFE_TYPES.indexOf(field.type) === -1) errors.push(here + '.type desteklenmiyor: ' + field.type);
                if (field.offset !== undefined && field.offset < 0) errors.push(here + '.offset negatif olamaz.');
                if (field.length !== undefined && field.length < 0) errors.push(here + '.length negatif olamaz.');
                if (field.length === undefined && !field.lengthFrom && (!field.children || !field.children.length)) errors.push(here + ' length veya lengthFrom içermelidir.');
                if (field.children) inspect(field.children, here + '.children');
            });
        }
        inspect(schema.fields, 'fields');
        return { valid: errors.length === 0, errors: errors, schema: schema };
    }

    function exportJSON(schema, space) {
        var checked = validateSchema(schema);
        if (!checked.valid) throw new Error(checked.errors.join('\n'));
        return JSON.stringify(checked.schema, null, space === undefined ? 2 : space);
    }

    function importJSON(text) {
        var parsed = JSON.parse(String(text));
        var checked = validateSchema(parsed);
        if (!checked.valid) throw new Error(checked.errors.join('\n'));
        return checked.schema;
    }

    function yamlScalar(value) {
        if (value === null) return 'null';
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return JSON.stringify(String(value));
    }

    function yamlLines(value, indent) {
        var pad = new Array(indent + 1).join(' ');
        var lines = [];
        if (Array.isArray(value)) {
            value.forEach(function (item) {
                if (isObject(item)) {
                    var keys = Object.keys(item);
                    if (!keys.length) return lines.push(pad + '- {}');
                    var first = keys.shift();
                    if (isObject(item[first]) || Array.isArray(item[first])) {
                        lines.push(pad + '- ' + first + ':');
                        lines = lines.concat(yamlLines(item[first], indent + 4));
                    } else lines.push(pad + '- ' + first + ': ' + yamlScalar(item[first]));
                    keys.forEach(function (key) {
                        if (isObject(item[key]) || Array.isArray(item[key])) {
                            lines.push(pad + '  ' + key + ':');
                            lines = lines.concat(yamlLines(item[key], indent + 4));
                        } else lines.push(pad + '  ' + key + ': ' + yamlScalar(item[key]));
                    });
                } else lines.push(pad + '- ' + yamlScalar(item));
            });
        } else Object.keys(value).forEach(function (key) {
            if (isObject(value[key]) || Array.isArray(value[key])) {
                lines.push(pad + key + ':');
                lines = lines.concat(yamlLines(value[key], indent + 2));
            } else lines.push(pad + key + ': ' + yamlScalar(value[key]));
        });
        return lines;
    }

    function exportYAML(schema) {
        var checked = validateSchema(schema);
        if (!checked.valid) throw new Error(checked.errors.join('\n'));
        return yamlLines(checked.schema, 0).join('\n') + '\n';
    }

    function parseScalar(text) {
        text = text.trim();
        if (!text.length) return {};
        if (text === '{}') return {};
        if (text === 'null') return null;
        if (text === 'true') return true;
        if (text === 'false') return false;
        if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return Number(text);
        if (text[0] === '"') return JSON.parse(text);
        throw new Error('Desteklenmeyen YAML değeri: ' + text);
    }

    // Bilerek küçük bir parser: yalnızca exportYAML tarafından üretilen, executable
    // tag/alias içermeyen mapping ve sequence alt kümesini kabul eder.
    function importYAML(text) {
        var source = String(text);
        if (/[!&*]|<<\s*:/.test(source)) throw new Error('YAML tag, alias ve merge anahtarları desteklenmez.');
        var rows = source.split(/\r?\n/).filter(function (line) { return line.trim(); }).map(function (line, number) {
            var match = /^( *)(.*)$/.exec(line);
            if (match[1].length % 2) throw new Error('Geçersiz girinti, satır ' + (number + 1));
            return { indent: match[1].length, text: match[2], number: number + 1 };
        });
        var cursor = 0;
        function block(indent, arrayMode) {
            var output = arrayMode ? [] : {};
            while (cursor < rows.length && rows[cursor].indent === indent) {
                var row = rows[cursor++];
                var item = row.text;
                if (arrayMode) {
                    var sequence = /^- ([A-Za-z][\w-]*):(?: (.*))?$/.exec(item);
                    if (!sequence) throw new Error('Geçersiz YAML listesi, satır ' + row.number);
                    var object = {};
                    object[sequence[1]] = sequence[2] === undefined ? block(indent + 4, rows[cursor] && rows[cursor].text.indexOf('- ') === 0) : parseScalar(sequence[2]);
                    while (cursor < rows.length && rows[cursor].indent === indent + 2 && rows[cursor].text.indexOf('- ') !== 0) parseProperty(object, indent + 2);
                    output.push(object);
                } else parseProperty(output, indent, row);
            }
            return output;
        }
        function parseProperty(target, indent, supplied) {
            var row = supplied || rows[cursor++];
            var match = /^([A-Za-z][\w-]*):(?: (.*))?$/.exec(row.text);
            if (!match) throw new Error('Geçersiz YAML alanı, satır ' + row.number);
            if (match[2] !== undefined) target[match[1]] = parseScalar(match[2]);
            else {
                var next = rows[cursor];
                if (!next || next.indent <= indent) target[match[1]] = {};
                else target[match[1]] = block(next.indent, next.text.indexOf('- ') === 0);
            }
        }
        var parsed = block(0, false);
        if (cursor !== rows.length) throw new Error('YAML yapısı okunamadı, satır ' + rows[cursor].number);
        var checked = validateSchema(parsed);
        if (!checked.valid) throw new Error(checked.errors.join('\n'));
        return checked.schema;
    }

    function utf8Encode(text) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
        return Uint8Array.from(unescape(encodeURIComponent(text)), function (char) { return char.charCodeAt(0); });
    }
    function utf8Decode(bytes) {
        if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
        return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
    }
    function bytesToBase64(bytes) {
        if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
        var binary = ''; bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
        return btoa(binary);
    }
    function base64ToBytes(text) {
        if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(text, 'base64'));
        var binary = atob(text); return Uint8Array.from(binary, function (char) { return char.charCodeAt(0); });
    }
    function encodeHash(schema) {
        return '#schema=' + bytesToBase64(utf8Encode(exportJSON(schema, 0))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function decodeHash(hash) {
        var match = /(?:^#|[&#])schema=([^&]+)/.exec(String(hash));
        if (!match) throw new Error('URL hash içinde schema bulunamadı.');
        var encoded = decodeURIComponent(match[1]).replace(/-/g, '+').replace(/_/g, '/');
        while (encoded.length % 4) encoded += '=';
        return importJSON(utf8Decode(base64ToBytes(encoded)));
    }

    function resolveFields(schemaInput, valuesOrBytes, optionalBytes) {
        var checked = validateSchema(schemaInput);
        if (!checked.valid) throw new Error(checked.errors.join('\n'));
        var values = isObject(valuesOrBytes) && !(valuesOrBytes instanceof Uint8Array) ? valuesOrBytes : {};
        var bytes = optionalBytes || (values === valuesOrBytes ? null : valuesOrBytes);
        var byteLength = bytes && typeof bytes.length === 'number' ? bytes.length : Infinity;
        function resolveList(fields, base) {
            var cursor = base;
            var result = [];
            fields.forEach(function (field) {
                if (field.when && values[field.when.field] !== field.when.equals) return;
                var offset = field.offset === undefined ? cursor : base + field.offset;
                var length = field.lengthFrom ? integer(values[field.lengthFrom], -1) : field.length;
                if (length === undefined && field.children) length = 0;
                if (!Number.isInteger(length) || length < 0) throw new Error(field.name + ' için length çözümlenemedi.');
                var resolved = Object.assign({}, field, { offset: offset, length: length, endIndex: offset + length });
                if (resolved.endIndex > byteLength) resolved.outOfBounds = true;
                if (field.children) {
                    resolved.children = resolveList(field.children, offset);
                    if (!field.length && !field.lengthFrom && resolved.children.length) {
                        resolved.endIndex = Math.max.apply(null, resolved.children.map(function (child) { return child.endIndex; }));
                        resolved.length = resolved.endIndex - offset;
                    }
                }
                result.push(resolved);
                cursor = Math.max(cursor, resolved.endIndex);
            });
            return result;
        }
        return resolveList(checked.schema.fields, 0);
    }

    function rowsFromDecoded(decoded) {
        if (Array.isArray(decoded)) return decoded;
        return Object.keys(decoded || {}).map(function (key) { return { field: key, value: decoded[key] }; });
    }
    function exportDecodedJSON(decoded, space) { return JSON.stringify(decoded, null, space === undefined ? 2 : space); }
    function csvCell(value) {
        var text = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
        return '"' + text.replace(/"/g, '""') + '"';
    }
    function exportDecodedCSV(decoded) {
        var rows = rowsFromDecoded(decoded);
        var keys = [];
        rows.forEach(function (row) { Object.keys(row).forEach(function (key) { if (keys.indexOf(key) < 0) keys.push(key); }); });
        return keys.map(csvCell).join(',') + '\n' + rows.map(function (row) { return keys.map(function (key) { return csvCell(row[key]); }).join(','); }).join('\n') + (rows.length ? '\n' : '');
    }

    return Object.freeze({
        normalizeSchema: normalizeSchema, validateSchema: validateSchema,
        exportJSON: exportJSON, importJSON: importJSON,
        exportYAML: exportYAML, importYAML: importYAML,
        encodeHash: encodeHash, decodeHash: decodeHash,
        resolveFields: resolveFields,
        exportDecodedJSON: exportDecodedJSON, exportDecodedCSV: exportDecodedCSV
    });
}));
