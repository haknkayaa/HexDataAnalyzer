document.getElementById('myTextarea').addEventListener('input', function () {
    editLiveText();
});


let idList = [];

let presets = {};
let presetFiles = {};
let presetsReady = false;

function setupPresetManifest(manifest, loadedPresets) {
    var select = document.getElementById('presetSelect');

    if (!Array.isArray(manifest.presets)) {
        throw new Error('Preset manifesti geçersiz');
    }

    presets = loadedPresets || {};
    presetFiles = manifest.presets.reduce(function (files, preset) {
        files[preset.id] = preset.file;
        return files;
    }, {});
    select.length = 1;
        manifest.presets.forEach(function (preset) {
            var option = document.createElement('option');
            option.value = preset.id;
            option.textContent = (loadedPresets && loadedPresets[preset.id] && loadedPresets[preset.id].name) || preset.name || preset.id;
            select.appendChild(option);
    });
    presetsReady = true;
    select.disabled = false;
    select.setAttribute('aria-busy', 'false');
    select.options[0].textContent = 'Preset seçin';
}

async function loadPresets() {
    var select = document.getElementById('presetSelect');

    try {
        if (window.location.protocol === 'file:') {
            throw new Error('Uygulama HTTP veya HTTPS üzerinden açılmalıdır.');
        }

        var response = await fetch('./presets/index.json', { cache: 'no-cache' });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        var manifest = await response.json();
        var presetEntries = await Promise.all(manifest.presets.map(async function (preset) {
            try {
                var presetResponse = await fetch('./presets/' + preset.file, { cache: 'no-cache' });
                if (!presetResponse.ok) throw new Error('HTTP ' + presetResponse.status);
                return [preset.id, await presetResponse.json()];
            } catch (error) {
                console.warn('Preset atlandı (' + preset.id + '):', error);
                return null;
            }
        }));
        presetEntries = presetEntries.filter(Boolean);
        if (!presetEntries.length) throw new Error('Kullanılabilir preset bulunamadı.');
        var availableIds = presetEntries.map(function (entry) { return entry[0]; });
        setupPresetManifest({ version: manifest.version, presets: manifest.presets.filter(function (preset) { return availableIds.indexOf(preset.id) !== -1; }) }, Object.fromEntries(presetEntries));
    } catch (error) {
        console.error('Presetler yüklenemedi:', error);
        select.disabled = true;
        select.setAttribute('aria-busy', 'false');
        select.options[0].textContent = 'Presetler yüklenemedi';
    }
}

loadPresets();

// create random light color without white, black and gray
let randomColor = ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC', '#D7CCC8', '#F5F5F5', '#CFD8DC'];



function editLiveText() {
    if (document.getElementById('inputFormat').value !== 'hex') {
        document.getElementById('inputFeedback').textContent = 'Girdiyi byte dizisine çevirmek için Dönüştür düğmesini kullanın.';
        return;
    }

    // metni iki karakterli aralarına boşluk koyarak yazdır
    // örnek: "me rh ab a"
    var myText = document.getElementById('myTextarea').value;

    var newText = twoDigitEdit(myText);

    // change text
    document.getElementById('myTextarea').value = newText;

    analyze();
}

function convertInputFormat() {
    var textarea = document.getElementById('myTextarea');
    var format = document.getElementById('inputFormat').value;
    try {
        var bytes = format === 'base64'
            ? HexInputTools.base64ToBytes(textarea.value)
            : format === 'ascii'
                ? HexInputTools.asciiToBytes(textarea.value)
                : HexInputTools.parseHexText(textarea.value);
        textarea.value = HexInputTools.bytesToHex(bytes);
        document.getElementById('inputFormat').value = 'hex';
        document.getElementById('presetSelect').value = '';
        analyze();
    } catch (error) {
        setHexValidationState({ valid: false, message: error.message });
    }
}

function twoDigitEdit(myText) {
    var validation = parseHexInput(myText);

    if (!validation.valid) {
        return myText;
    }

    myText = validation.hex;

    var myTextArray = myText.split('');
    var myTextArrayLength = myTextArray.length;
    var newText = '';

    for (var i = 0; i < myTextArrayLength; i++) {
        if (i % 2 == 1) {
            newText += myTextArray[i] + ' ';
        }
        else {
            newText += myTextArray[i];
        }
    }

    return newText.trim();
}

function parseHexInput(text) {
    var compact = String(text).replace(/\s/g, '');
    var invalidIndex = compact.search(/[^0-9a-f]/i);

    if (invalidIndex !== -1) {
        return {
            valid: false,
            message: 'Geçersiz hex karakteri: "' + compact[invalidIndex] + '" (konum ' + (invalidIndex + 1) + ').'
        };
    }

    if (compact.length % 2 !== 0) {
        return { valid: false, message: 'Hex girdisi tam byte içermeli; son hane eşleşmiyor.' };
    }

    var normalizedHex = compact.toUpperCase();

    return {
        valid: true,
        hex: normalizedHex,
        bytes: normalizedHex.match(/.{2}/g) || []
    };
}

function setHexValidationState(validation) {
    var textarea = document.getElementById('myTextarea');
    var feedback = document.getElementById('inputFeedback');
    var message = validation.valid ? '' : validation.message;
    textarea.setCustomValidity(message);
    textarea.setAttribute('aria-invalid', String(!validation.valid));
    textarea.title = message;
    feedback.textContent = message;
    feedback.setAttribute('role', validation.valid ? 'status' : 'alert');
}


function getConversionOptions(includeCustom) {
    return '<option value="uint8">İşaretsiz 8-bit (uint8)</option><option value="uint16">İşaretsiz 16-bit (uint16)</option><option value="uint32">İşaretsiz 32-bit (uint32)</option><option value="uint64">İşaretsiz 64-bit (uint64)</option><option value="int8">İşaretli 8-bit (int8)</option><option value="int16">İşaretli 16-bit (int16)</option><option value="int32">İşaretli 32-bit (int32)</option><option value="int64">İşaretli 64-bit (int64)</option><option value="char">Karakter (char)</option><option value="float">Float 32-bit (float)</option><option value="double">Double 64-bit (double)</option><option value="ascii">ASCII metin (ascii)</option><option value="hex">Hex (hex)</option><option value="bits">Bit dizisi (bits)</option><option value="epochUtc">Epoch → UTC (epochUtc)</option><option value="mac">MAC adresi (mac)</option><option value="ipv4">IPv4 adresi (ipv4)</option><option value="protocol">IP protokolü (protocol)</option><option value="udpLength">UDP uzunluğu (udpLength)</option>' + (includeCustom ? '<option value="custom">Custom / Alt alanlar</option>' : '');
}

// Alt alanlar ana alanın göreli byte ya da bit aralığıyla tanımlanır.
function getBitDefinitionsMarkup() {
    var inputs = '<div class="bit-definition bit-definition--head"><span>Alan</span><span>Kapsam</span><span>Baş.</span><span>Bitiş</span><span>Çevrim</span><span>Değer</span></div>';
    return '<div class="bit-definitions"><div class="bit-definitions-header"><button type="button" class="bit-definitions-toggle" aria-expanded="true">⌄ Alt alanlar</button><button type="button" class="bit-definition-add" onclick="addBitDefinition(this)">+ Alt alan ekle</button></div><div class="bit-definition-grid">' + inputs + '</div></div>';
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getBitDefinitionRowMarkup(label, scope, start, end, type) {
    var options = getConversionOptions(false).replace('value="' + (type || 'hex') + '"', 'value="' + (type || 'hex') + '" selected');
    return '<div class="bit-definition">'
        + '<input type="text" data-bit-label value="' + escapeHtmlAttribute(label) + '" oninput="changedValuesApplyChanges()">'
        + '<select data-child-scope onchange="changedValuesApplyChanges()"><option value="byte"' + (scope === 'byte' ? ' selected' : '') + '>Byte</option><option value="bit"' + (scope === 'bit' ? ' selected' : '') + '>Bit</option></select>'
        + '<input type="number" data-bit-start value="' + start + '" min="0" oninput="changedValuesApplyChanges()">'
        + '<input type="number" data-bit-end value="' + end + '" min="1" oninput="changedValuesApplyChanges()">'
        + '<select data-bit-type onchange="changedValuesApplyChanges()">' + options + '</select>'
        + '<input type="text" data-bit-value onchange="applyChildValue(this)">'
        + '<button type="button" class="bit-definition-remove" onclick="removeBitDefinition(this)" aria-label="Alt alanı kaldır" title="Alt alanı kaldır"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></svg></button>'
        + '</div>';
}

function addBitDefinition(button) {
    var grid = button.closest('.bit-definitions').querySelector('.bit-definition-grid');
    var definitions = grid.querySelectorAll('.bit-definition:not(.bit-definition--head)');
    var nextStart = definitions.length ? Number(definitions[definitions.length - 1].querySelector('[data-bit-end]').value) : 0;
    grid.insertAdjacentHTML('beforeend', getBitDefinitionRowMarkup('Yeni alt alan', 'byte', nextStart, nextStart + 1, 'hex'));
    updateChildRangeLimits(button.closest('tr'));
    changedValuesApplyChanges();
}

function removeBitDefinition(button) {
    button.closest('.bit-definition').remove();
    changedValuesApplyChanges();
}

function toggleBitDefinitions(bitRow, dataType) {
    bitRow.hidden = dataType !== 'custom';
}

function syncChildColor(childRow, color) {
    childRow.style.setProperty('--field-color', color);
}

function updateChildRangeLimits(childRow) {
    var parentRow = childRow.previousElementSibling;
    var byteCount = Math.max(0, Number(parentRow.cells[4].querySelector('input').value) - Number(parentRow.cells[3].querySelector('input').value));

    childRow.querySelectorAll('.bit-definition:not(.bit-definition--head)').forEach(function (definition) {
        var scope = definition.querySelector('[data-child-scope]').value;
        var limit = scope === 'bit' ? byteCount * 8 : byteCount;
        var startInput = definition.querySelector('[data-bit-start]');
        var endInput = definition.querySelector('[data-bit-end]');
        startInput.max = Math.max(0, limit - 1);
        endInput.max = limit;
        startInput.title = (scope === 'bit' ? 'Bit' : 'Byte') + ' aralığı: 0–' + Math.max(0, limit - 1);
        endInput.title = 'Bitiş sınırı: ' + limit;
    });
}

function getDefinitionRows(table) {
    return Array.from(table.rows).filter(function (row) {
        return row.rowIndex > 0 && !row.classList.contains('bit-definition-row');
    });
}

function addNewIdentifier(field = {}) {
    console.log('[+] add new identifier');


    // Get the table element
    var table = document.getElementById('highlightTable');

    // Insert a new row at the end of the table
    var newRow = table.insertRow(-1);
    newRow.className = 'field-definition-row';

    // Insert new cells in the row
    var cell_no = newRow.insertCell(0);
    var cell_label = newRow.insertCell(1);
    var cell_color = newRow.insertCell(2);
    var cell_startIndex = newRow.insertCell(3);
    var cell_endIndex = newRow.insertCell(4);
    var cell_dataType = newRow.insertCell(5);
    var cell_converted = newRow.insertCell(6);
    var cell_action = newRow.insertCell(7);

    var bitRow = table.insertRow(newRow.rowIndex + 1);
    bitRow.className = 'bit-definition-row';
    var bitCell = bitRow.insertCell(0);
    bitCell.colSpan = 8;
    bitCell.innerHTML = getBitDefinitionsMarkup();

    // Add some text to the new cells
    cell_no.innerHTML = getDefinitionRows(table).length;
    cell_label.innerHTML = '<input type="text" class="field-label" name="head" value="label" style="width: 100%; height: 28px;">';
    cell_color.innerHTML = '<input type="color" class="field-color" name="head" value="' + randomColor[Math.floor(Math.random() * randomColor.length)] + '" style="width: 100%; height: 28px;">';
    cell_startIndex.innerHTML = '<input type="number" class="field-start-index" name="head" value="0" style="width: 68px; height: 28px;">';
    cell_endIndex.innerHTML = '<input type="number" class="field-end-index" name="head" value="0" style="width: 68px; height: 28px;">';
    cell_dataType.innerHTML = '<select name="valueType" class="field-value-type" style="height: 28px;">' + getConversionOptions(true) + '</select>';
    cell_converted.innerHTML = '<input type="text" class="field-converted-value" name="head" value="0" style="width: 100%; height: 28px;">';
    cell_action.innerHTML = '<button type="button" class="table-remove" onclick="removeCurrentRow(this)" aria-label="Alanı kaldır" title="Alanı kaldır"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></svg></button>';

    cell_label.getElementsByTagName('input')[0].value = field.label || 'label';
    cell_color.getElementsByTagName('input')[0].value = field.color || randomColor[Math.floor(Math.random() * randomColor.length)];
    syncChildColor(bitRow, cell_color.getElementsByTagName('input')[0].value);
    cell_startIndex.getElementsByTagName('input')[0].value = field.startIndex ?? 0;
    cell_endIndex.getElementsByTagName('input')[0].value = field.endIndex ?? 0;
    cell_dataType.getElementsByTagName('select')[0].value = field.dataType || 'uint8';
    cell_converted.getElementsByTagName('input')[0].addEventListener('change', function () {
        applyFieldValue(newRow, this.value);
    });
    toggleBitDefinitions(bitRow, cell_dataType.getElementsByTagName('select')[0].value);

    var children = field.children || field.bitDefinitions || [];
    children.forEach(function (child) {
        bitRow.querySelector('.bit-definition-grid').insertAdjacentHTML('beforeend', getBitDefinitionRowMarkup(child.label || '', child.scope || 'bit', child.start, child.end, child.type || 'hex'));
        var row = bitRow.querySelector('.bit-definition:last-child');
        row.querySelector('[data-bit-type]').value = child.type || 'hex';
    });
    updateChildRangeLimits(bitRow);
    bitRow.querySelectorAll('input, select').forEach(function (input) {
        input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', function () {
            if (input.matches('[data-bit-value]')) {
                return;
            }
            changedValuesApplyChanges();
        });
    });
    var toggleChildFields = function () {
        var definitions = bitRow.querySelector('.bit-definition-grid');
        var collapsed = definitions.hidden = !definitions.hidden;
        var toggle = bitRow.querySelector('.bit-definitions-toggle');
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.textContent = (collapsed ? '›' : '⌄') + ' Alt alanlar';
    };
    bitRow.querySelector('.bit-definitions-toggle').addEventListener('click', function (event) {
        event.stopPropagation();
        toggleChildFields();
    });
    bitRow.querySelector('.bit-definitions-header').addEventListener('click', function (event) {
        if (!event.target.closest('button')) {
            toggleChildFields();
        }
    });
    bitRow.addEventListener('change', function (event) {
        if (event.target.matches('[data-child-scope]')) {
            updateChildRangeLimits(bitRow);
        }
    });


    // Add an event listener for the change event
    cell_label.getElementsByTagName('input')[0].addEventListener('input', function () {
        changedValuesApplyChanges();
    });
    cell_color.getElementsByTagName('input')[0].addEventListener('change', function () {
        syncChildColor(bitRow, this.value);
        changedValuesApplyChanges();
    });
    cell_startIndex.getElementsByTagName('input')[0].addEventListener('input', function () {
        updateChildRangeLimits(bitRow);
        changedValuesApplyChanges();
    });
    cell_endIndex.getElementsByTagName('input')[0].addEventListener('input', function () {
        updateChildRangeLimits(bitRow);
        changedValuesApplyChanges();
    });
    cell_dataType.getElementsByTagName('select')[0].addEventListener('change', function () {
        toggleBitDefinitions(bitRow, this.value);
        changedValuesApplyChanges();
    });
}

function writeRawBytes(start, end, bytes) {
    var rawBytes = document.getElementById('myTextarea').value.split(' ').filter(function (byte) { return byte.length > 0; });
    rawBytes.splice.apply(rawBytes, [start, end - start].concat(bytes));
    document.getElementById('myTextarea').value = rawBytes.join(' ');
    analyze();
}

function isLittleEndian() {
    var select = document.getElementById('endianSelect');
    return Boolean(select && select.value === 'little');
}

function bytesForNumericConversion(bytes) {
    return isLittleEndian() ? bytes.slice().reverse() : bytes.slice();
}

function decodeIntegerBytes(bytes, type) {
    var match = /^(u?int)(8|16|32|64)$/.exec(type);
    if (!match || bytes.length !== Number(match[2]) / 8) return 'Geçersiz uzunluk';
    var normalized = bytesForNumericConversion(bytes);
    var value = BigInt('0x' + normalized.join(''));
    var bits = BigInt(match[2]);
    if (match[1] === 'int' && value >= (1n << (bits - 1n))) value -= 1n << bits;
    return value.toString();
}

function decodeFloatingBytes(bytes, type) {
    var size = type === 'float' ? 4 : 8;
    if (bytes.length !== size) return 'Geçersiz uzunluk';
    var buffer = new ArrayBuffer(size);
    var view = new DataView(buffer);
    bytes.forEach(function (byte, index) { view.setUint8(index, parseInt(byte, 16)); });
    return type === 'float' ? view.getFloat32(0, isLittleEndian()) : view.getFloat64(0, isLittleEndian());
}

function encodeValueToBytes(value, type, byteLength) {
    var text = String(value).trim();
    var hex;
    var integerType = /^(u?int)(8|16|32|64)$/.exec(type);

    if (type === 'custom' || type === 'hex' || type === 'bits') {
        hex = text.replace(/^0x/i, '').replace(/\s/g, '');
        if (!/^[0-9a-f]*$/i.test(hex) || hex.length > byteLength * 2) throw new Error('Geçerli hex girin.');
        return hex.padStart(byteLength * 2, '0').match(/../g) || [];
    }
    if (type === 'mac') {
        var mac = text.replace(/[:-]/g, '');
        if (!/^[0-9a-f]{12}$/i.test(mac) || byteLength !== 6) throw new Error('Geçerli MAC girin.');
        return mac.match(/../g).map(function (byte) { return byte.toUpperCase(); });
    }
    if (type === 'ipv4') {
        var octets = text.split('.');
        if (byteLength !== 4 || octets.length !== 4 || octets.some(function (octet) { return !/^\d+$/.test(octet) || Number(octet) > 255; })) throw new Error('Geçerli IPv4 girin.');
        return octets.map(function (octet) { return Number(octet).toString(16).padStart(2, '0').toUpperCase(); });
    }
    if (type === 'ascii' || type === 'char') {
        if (text.length > byteLength || (type === 'char' && byteLength !== 1)) throw new Error('Metin byte aralığına sığmıyor.');
        return Array.from(text).map(function (character) { return character.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase(); }).concat(Array(byteLength - text.length).fill('00'));
    }
    if (type === 'epochUtc') {
        var seconds = /^\d+$/.test(text) ? Number(text) : Math.floor(new Date(text).getTime() / 1000);
        if (!Number.isFinite(seconds) || byteLength !== 4) throw new Error('Geçerli UTC tarih girin.');
        hex = BigInt(seconds).toString(16);
        return hex.padStart(8, '0').match(/../g).map(function (byte) { return byte.toUpperCase(); });
    }
    if (type === 'float' || type === 'double') {
        if ((type === 'float' && byteLength !== 4) || (type === 'double' && byteLength !== 8) || !Number.isFinite(Number(text))) throw new Error('Geçerli sayısal değer girin.');
        var buffer = new ArrayBuffer(byteLength);
        var view = new DataView(buffer);
        if (type === 'float') view.setFloat32(0, Number(text), isLittleEndian()); else view.setFloat64(0, Number(text), isLittleEndian());
        return Array.from(new Uint8Array(buffer)).map(function (byte) { return byte.toString(16).padStart(2, '0').toUpperCase(); });
    }
    if (type === 'protocol') {
        var protocolMatch = text.match(/\d+/g);
        text = protocolMatch ? protocolMatch[protocolMatch.length - 1] : text;
    }
    if (type === 'udpLength') type = 'uint16';
    var numberValue = BigInt(text);
    var bitLength = byteLength * 8;
    var bitLimit = 1n << BigInt(bitLength);

    if (integerType && integerType[1] === 'int') {
        var signedLimit = 1n << BigInt(bitLength - 1);
        if (numberValue < -signedLimit || numberValue >= signedLimit) throw new Error('Değer işaretli sayı aralığına sığmıyor.');
        if (numberValue < 0) numberValue = bitLimit + numberValue;
    } else if (numberValue < 0 || numberValue >= bitLimit) {
        throw new Error('Değer byte aralığına sığmıyor.');
    }
    hex = numberValue.toString(16).padStart(byteLength * 2, '0');
    var encodedBytes = hex.match(/../g).map(function (byte) { return byte.toUpperCase(); });
    return isLittleEndian() && integerType ? encodedBytes.reverse() : encodedBytes;
}

function applyFieldValue(fieldRow, value) {
    try {
        var start = Number(fieldRow.cells[3].querySelector('input').value);
        var end = Number(fieldRow.cells[4].querySelector('input').value);
        var type = fieldRow.cells[5].querySelector('select').value;
        writeRawBytes(start, end, encodeValueToBytes(value, type, end - start));
    } catch (error) {
        alert(error.message);
        analyze();
    }
}

function applyChildValue(input) {
    var childRow = input.closest('.bit-definition');
    var customRow = childRow.closest('tr');
    var fieldRow = customRow.previousElementSibling;
    var fieldStart = Number(fieldRow.cells[3].querySelector('input').value);
    var fieldEnd = Number(fieldRow.cells[4].querySelector('input').value);
    var childStart = Number(childRow.querySelector('[data-bit-start]').value);
    var childEnd = Number(childRow.querySelector('[data-bit-end]').value);
    var scope = childRow.querySelector('[data-child-scope]').value;
    var type = childRow.querySelector('[data-bit-type]').value;

    try {
        if (scope === 'byte') {
            writeRawBytes(fieldStart + childStart, fieldStart + childEnd, encodeValueToBytes(input.value, type, childEnd - childStart));
            return;
        }

        var rawBytes = document.getElementById('myTextarea').value.split(' ').filter(function (byte) { return byte.length > 0; });
        var fieldBytes = rawBytes.slice(fieldStart, fieldEnd);
        var bitString = fieldBytes.map(function (byte) { return parseInt(byte, 16).toString(2).padStart(8, '0'); }).join('');
        var bitLength = childEnd - childStart;
        var bits = type === 'bits' ? input.value.replace(/^0b/i, '') : BigInt(input.value).toString(2);
        if (!/^[01]+$/.test(bits) || bits.length > bitLength) throw new Error('Geçerli bit değeri girin.');
        bits = bits.padStart(bitLength, '0');
        bitString = bitString.slice(0, childStart) + bits + bitString.slice(childEnd);
        var updated = bitString.match(/.{8}/g).map(function (part) { return parseInt(part, 2).toString(16).padStart(2, '0').toUpperCase(); });
        writeRawBytes(fieldStart, fieldEnd, updated);
    } catch (error) {
        alert(error.message);
        analyze();
    }
}

function removeCurrentRow(row) {
    var fieldRow = row.closest('tr');
    var bitRow = fieldRow.nextElementSibling;

    if (bitRow && bitRow.classList.contains('bit-definition-row')) {
        bitRow.remove();
    }
    fieldRow.remove();
    analyze();
    console.log("Field row deleted");
}

async function loadPreset(name) {
    if (!name || !presetsReady || !presetFiles[name]) {
        return;
    }

    var preset = presets[name];

    try {
        if (!preset) {
            var response = await fetch('./presets/' + presetFiles[name], { cache: 'no-cache' });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            preset = await response.json();
            presets[name] = preset;
        }

        if ((!preset.hex && !preset.source) || !Array.isArray(preset.fields)) {
            throw new Error('Preset dosyası geçersiz');
        }

    } catch (error) {
        console.error('Preset yüklenemedi:', error);
        return;
    }

    clearContent();
    var presetBytes = preset.hex
        ? HexInputTools.parseHexText(preset.hex)
        : preset.sourceFormat === 'base64'
            ? HexInputTools.base64ToBytes(preset.source)
            : HexInputTools.asciiToBytes(preset.source);
    document.getElementById('myTextarea').value = HexInputTools.bytesToHex(presetBytes);
    document.getElementById('presetSelect').value = name;
    document.getElementById('endianSelect').value = preset.endian || 'big';

    for (var i = 0; i < preset.fields.length; i++) {
        addNewIdentifier(preset.fields[i]);
    }

    analyze();
    document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openImportDialog() {
    document.getElementById('definitionsFile').click();
}

function openDataFileDialog() {
    document.getElementById('dataFile').click();
}

async function importDataFile(event) {
    var input = event.target;
    var file = input.files && input.files[0];

    if (!file) {
        return;
    }

    try {
        var textarea = document.getElementById('myTextarea');
        var loaded = await HexInputTools.readFile(file);
        var packets = Array.isArray(loaded) ? loaded : null;
        var bytes = packets ? packets[0] : loaded;
        if (!bytes) throw new Error('Dosyada paket bulunamadı.');
        textarea.value = HexInputTools.bytesToHex(bytes);

        document.getElementById('inputFormat').value = 'hex';
        document.getElementById('presetSelect').value = '';
        analyze();
        if (packets) document.getElementById('inputFeedback').textContent = packets.length + ' paket bulundu; ilk paket açıldı.';
    } catch (error) {
        setHexValidationState({ valid: false, message: 'Dosya okunamadı: ' + error.message });
    } finally {
        input.value = '';
    }
}

function exportDefinitions() {
    analyze();

    var exportData = {
        format: 'hexscope-field-definitions',
        version: 1,
        fields: idList.map(function (field) {
            return {
                label: field.label,
                color: field.color,
                startIndex: Number(field.startIndex),
                endIndex: Number(field.endIndex),
                dataType: field.dataType,
                children: field.children && field.children.map(function (definition) {
                    return {
                        label: definition.label,
                        scope: definition.scope,
                        start: definition.start,
                        end: definition.end,
                        type: definition.type
                    };
                })
            };
        })
    };

    var file = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    var fileUrl = URL.createObjectURL(file);

    link.href = fileUrl;
    link.download = 'hexscope-fields.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(fileUrl);
}

function importDefinitions(event) {
    var input = event.target;
    var file = input.files[0];

    if (!file) {
        return;
    }

    var reader = new FileReader();
    reader.onload = function () {
        try {
            var extension = file.name.split('.').pop().toLowerCase();
            var importedData = extension === 'yaml' || extension === 'yml'
                ? HexSchemaTools.importYAML(reader.result)
                : JSON.parse(reader.result);
            var fields = Array.isArray(importedData) ? importedData : importedData.fields;

            if (!Array.isArray(fields)) {
                throw new Error('Dosyada alan tanımları bulunamadı.');
            }

            var normalizedFields = fields.map(function (field, index) {
                if (field.offset !== undefined || field.length !== undefined) {
                    field = Object.assign({}, field, {
                        label: field.name,
                        startIndex: field.offset,
                        endIndex: Number(field.offset) + Number(field.length),
                        dataType: field.type
                    });
                }
                return normalizeImportedField(field, index);
            });
            clearDefinitions();

            for (var i = 0; i < normalizedFields.length; i++) {
                addNewIdentifier(normalizedFields[i]);
            }

            analyze();
        } catch (error) {
            alert('Alan tanımları içe aktarılamadı: ' + error.message);
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}

function normalizeImportedField(field, index) {
    var supportedTypes = ['uint8', 'uint16', 'uint32', 'uint64', 'int8', 'int16', 'int32', 'int64', 'char', 'float', 'double', 'ascii', 'hex', 'bits', 'custom', 'epochUtc', 'mac', 'ipv4', 'protocol', 'udpLength'];

    if (!field || typeof field !== 'object') {
        throw new Error('Satır ' + (index + 1) + ' geçerli bir alan tanımı değil.');
    }

    var startIndex = Number(field.startIndex);
    var endIndex = Number(field.endIndex);

    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex <= startIndex) {
        throw new Error('Satır ' + (index + 1) + ' geçerli bir byte aralığı içermiyor.');
    }

    if (supportedTypes.indexOf(field.dataType) === -1) {
        throw new Error('Satır ' + (index + 1) + ' desteklenmeyen bir veri türü içeriyor.');
    }

    var bitLabels = {};
    if (field.bitLabels && typeof field.bitLabels === 'object') {
        Object.keys(field.bitLabels).forEach(function (bit) {
            if (/^[0-7]$/.test(bit) && typeof field.bitLabels[bit] === 'string') {
                bitLabels[bit] = field.bitLabels[bit].trim();
            }
        });
    }

    var children = Array.isArray(field.children || field.bitDefinitions) ? (field.children || field.bitDefinitions).map(function (definition) {
        return {
            label: typeof definition.label === 'string' ? definition.label.trim() : '',
            scope: definition.scope === 'byte' ? 'byte' : 'bit',
            start: Number(definition.start),
            end: Number(definition.end),
            type: supportedTypes.indexOf(definition.type) !== -1 && definition.type !== 'custom' ? definition.type : 'hex'
        };
    }) : [];

    return {
        label: typeof field.label === 'string' && field.label.trim() ? field.label.trim() : 'Alan ' + (index + 1),
        color: typeof field.color === 'string' && /^#[0-9a-f]{6}$/i.test(field.color) ? field.color : randomColor[index % randomColor.length],
        startIndex: startIndex,
        endIndex: endIndex,
        dataType: field.dataType,
        children: children
    };
}

function clearDefinitions() {
    var table = document.getElementById('highlightTable');

    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
}

function getCurrentBytes() {
    var parsed = parseHexInput(document.getElementById('myTextarea').value);
    if (!parsed.valid) throw new Error(parsed.message);
    return Uint8Array.from(parsed.bytes, function (byte) { return parseInt(byte, 16); });
}

function setToolOutput(id, value) {
    var output = document.getElementById(id);
    output.value = String(value);
    output.textContent = String(value);
}

function runBinarySearch() {
    try {
        var bytes = getCurrentBytes();
        var mode = document.getElementById('searchMode').value;
        var query = document.getElementById('searchQuery').value;
        var offsets;
        if (mode === 'ascii') offsets = BinaryTools.searchAscii(bytes, query, false);
        else if (mode === 'numeric') {
            offsets = BinaryTools.searchNumeric(bytes, query, { width: 4, endian: isLittleEndian() ? 'little' : 'big', signed: /^-/.test(query) });
        } else offsets = BinaryTools.searchHex(bytes, query);
        setToolOutput('searchResult', offsets.length ? 'Offset: ' + offsets.map(function (offset) { return '0x' + offset.toString(16).toUpperCase(); }).join(', ') : 'Eşleşme yok');
    } catch (error) { setToolOutput('searchResult', error.message); }
}

function calculateChecksums() {
    try {
        var bytes = getCurrentBytes();
        setToolOutput('checksumResult', 'CRC32 0x' + BinaryTools.crc32(bytes).toString(16).toUpperCase().padStart(8, '0')
            + ' · CRC16 0x' + BinaryTools.crc16Ccitt(bytes).toString(16).toUpperCase().padStart(4, '0')
            + ' · SUM8 0x' + BinaryTools.byteSum(bytes).toString(16).toUpperCase().padStart(2, '0')
            + ' · XOR 0x' + BinaryTools.xorChecksum(bytes).toString(16).toUpperCase().padStart(2, '0'));
    } catch (error) { setToolOutput('checksumResult', error.message); }
}

function splitCurrentFrames() {
    try {
        var frames = HexInputTools.splitFrames(getCurrentBytes(), document.getElementById('frameMagic').value);
        setToolOutput('frameResult', frames.length ? frames.length + ' frame: ' + frames.map(function (frame) { return frame.length + ' byte'; }).join(', ') : 'Magic bulunamadı');
    } catch (error) { setToolOutput('frameResult', error.message); }
}

function currentSchema() {
    analyze();
    return {
        version: 1,
        name: 'Hexscope Schema',
        endian: isLittleEndian() ? 'little' : 'big',
        fields: idList.map(function (field) {
            var schemaField = { name: field.label, type: field.dataType, color: field.color, offset: field.startIndex, length: field.endIndex - field.startIndex };
            if (field.children && field.children.length) schemaField.children = field.children.map(function (child) {
                return { name: child.label || 'alt_alan', type: child.type, scope: child.scope, offset: child.start, length: child.end - child.start };
            });
            return schemaField;
        })
    };
}

function downloadText(filename, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
}

function exportSchema(format) {
    try {
        var schema = currentSchema();
        var yaml = format === 'yaml';
        downloadText('hexscope-schema.' + (yaml ? 'yaml' : 'json'), yaml ? HexSchemaTools.exportYAML(schema) : HexSchemaTools.exportJSON(schema), yaml ? 'text/yaml' : 'application/json');
        setToolOutput('schemaResult', 'Schema ' + format.toUpperCase() + ' indirildi.');
    } catch (error) { setToolOutput('schemaResult', error.message); }
}

function decodedRows() {
    analyze();
    return idList.filter(function (field) { return field.rangeValid; }).map(function (field) {
        return { field: field.label, offset: field.startIndex, length: field.endIndex - field.startIndex, type: field.dataType, value: field.convertedValue };
    });
}

function exportDecoded(format) {
    var rows = decodedRows();
    var csv = format === 'csv';
    downloadText('hexscope-decoded.' + format, csv ? HexSchemaTools.exportDecodedCSV(rows) : HexSchemaTools.exportDecodedJSON(rows), csv ? 'text/csv' : 'application/json');
    setToolOutput('schemaResult', 'Çözümlenen sonuç ' + format.toUpperCase() + ' indirildi.');
}

function shareSchemaUrl() {
    try {
        var hash = HexSchemaTools.encodeHash(currentSchema());
        history.replaceState(null, '', location.pathname + location.search + hash);
        var url = location.href;
        var done = function () {
            setToolOutput('schemaResult', 'Schema linki kopyalandı.');
            var label = document.querySelector('#headerShareButton span');
            if (label) {
                label.textContent = 'Link kopyalandı';
                setTimeout(function () { label.textContent = 'Benzersiz paylaşılabilir linki kopyala'; }, 1800);
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(function () { setToolOutput('schemaResult', url); });
        else setToolOutput('schemaResult', url);
    } catch (error) { setToolOutput('schemaResult', error.message); }
}

async function compareDataFile(event) {
    var input = event.target;
    try {
        var loaded = await HexInputTools.readFile(input.files[0]);
        var other = Array.isArray(loaded) ? loaded[0] : loaded;
        var result = BinaryTools.diff(getCurrentBytes(), other);
        setToolOutput('diffResult', result.equal ? 'Dosyalar aynı.' : result.differences.length + ' byte farkı · ilk offset 0x' + result.differences[0].offset.toString(16).toUpperCase());
    } catch (error) { setToolOutput('diffResult', error.message); }
    finally { input.value = ''; }
}

function highlightText() {
    var validation = parseHexInput(document.getElementById('myTextarea').value);
    var characters = validation.valid ? validation.bytes : [];
    var resultContainer = document.getElementById('resultContainer');
    var fragment = document.createDocumentFragment();
    var columnCount = getInspectionColumnCount();
    var lines = [];

    if (!validation.valid) {
        var invalidResult = document.createElement('span');
        invalidResult.className = 'empty-result';
        invalidResult.setAttribute('role', 'alert');
        invalidResult.textContent = validation.message;
        fragment.appendChild(invalidResult);
    } else if (!characters.length) {
        var emptyResult = document.createElement('span');
        emptyResult.className = 'empty-result';
        emptyResult.textContent = 'Hex verisi girildiğinde biçimlendirilmiş çıktı burada görünür.';
        fragment.appendChild(emptyResult);
    }

    for (var lineStart = 0; lineStart < characters.length; lineStart += columnCount) {
        var lineEnd = Math.min(lineStart + columnCount, characters.length);
        var line = document.createElement('div');
        var offset = document.createElement('span');
        var code = document.createElement('code');

        line.className = 'dump-line';
        offset.className = 'dump-offset';
        offset.textContent = lineStart.toString(16).toUpperCase().padStart(4, '0');
        code.className = 'dump-code';

        for (var i = lineStart; i < lineEnd; i++) {
            var matchedField = getFieldAtByte(i);
            var byteElement = document.createElement('span');
            byteElement.className = matchedField ? 'byte-token byte-cell--marked' : 'byte-token';
            byteElement.textContent = characters[i];

            if (matchedField) {
                byteElement.style.setProperty('--field-color', matchedField.color);
                byteElement.title = matchedField.label;
                byteElement.dataset.fieldIndex = matchedField.index;
            }

            code.appendChild(byteElement);

            if (i < lineEnd - 1) {
                code.appendChild(document.createTextNode(' '));
            }
        }

        line.append(offset, code);
        lines.push(line);
    }

    if (lines.length) {
        var inspectionLayout = document.createElement('div');
        var dataPane = document.createElement('div');
        var annotations = document.createElement('aside');

        inspectionLayout.className = 'inspection-layout';
        dataPane.className = 'dump-data';
        annotations.className = 'dump-annotations';
        annotations.setAttribute('aria-label', 'Alan açıklamaları');

        lines.forEach(function (line) { dataPane.appendChild(line); });
        idList.forEach(function (field, fieldIndex) {
            var label = document.createElement('span');
            label.className = 'dump-field-label';
            label.textContent = field.label + ' → ' + (field.convertedValue || '—');
            label.style.setProperty('--field-color', field.color);
            label.dataset.fieldIndex = fieldIndex;
            label.title = label.textContent;
            annotations.appendChild(label);

            if (field.dataType === 'custom' && field.children) {
                field.children.forEach(function (definition) {
                    if (!definition.label) {
                        return;
                    }

                    var bitLabel = document.createElement('span');
                    var bitValue = definition.valueInput ? definition.valueInput.value : '—';
                    bitLabel.className = 'dump-field-label dump-bit-label';
                    bitLabel.textContent = '↳ ' + definition.label + ' → ' + (bitValue || '—');
                    bitLabel.style.setProperty('--field-color', field.color);
                    bitLabel.dataset.fieldIndex = fieldIndex;
                    bitLabel.title = bitLabel.textContent;
                    annotations.appendChild(bitLabel);
                });
            }
        });

        inspectionLayout.append(dataPane, annotations);
        fragment.appendChild(inspectionLayout);
    }

    resultContainer.classList.remove('result-output--split');

    resultContainer.replaceChildren(fragment);
    resultContainer.onmouseover = function (event) {
        var byteElement = event.target.closest('[data-field-index]');

        if (byteElement && resultContainer.contains(byteElement)) {
            setActiveField(Number(byteElement.dataset.fieldIndex));
        }
    };
    resultContainer.onmouseleave = clearActiveField;
}

function toggleInspectionAnnotations() {
    var resultContainer = document.getElementById('resultContainer');
    var toggleButton = document.getElementById('toggleAnnotationsButton');
    var isHidden = resultContainer.classList.toggle('result-output--annotations-hidden');
    var action = isHidden ? 'göster' : 'gizle';

    toggleButton.setAttribute('aria-pressed', String(!isHidden));
    toggleButton.setAttribute('aria-label', 'Alan açıklamalarını ' + action);
    toggleButton.title = 'Alan açıklamalarını ' + action;
}

function getInspectionColumnCount() {
    if (window.innerWidth >= 1500) {
        return 32;
    }

    if (window.innerWidth <= 640) {
        return 8;
    }

    return 16;
}

function getFieldAtByte(byteIndex) {
    for (var i = 0; i < idList.length; i++) {
        if (idList[i].rangeValid && byteIndex >= idList[i].startIndex && byteIndex < idList[i].endIndex) {
            return { index: i, label: idList[i].label, color: idList[i].color };
        }
    }

    return null;
}

function getFormattedInspectionText() {
    var bytes = document.getElementById('myTextarea').value.split(' ').filter(function (byte) { return byte.length > 0; });
    var columnCount = getInspectionColumnCount();
    var lines = [];

    for (var lineStart = 0; lineStart < bytes.length; lineStart += columnCount) {
        var lineEnd = Math.min(lineStart + columnCount, bytes.length);
        lines.push(lineStart.toString(16).toUpperCase().padStart(4, '0') + '  ' + bytes.slice(lineStart, lineEnd).join(' '));
    }

    if (idList.length) {
        lines.push('');
        lines.push('Alan tanımları');
        idList.forEach(function (field) {
            lines.push(field.label + ' → ' + (field.convertedValue || '—'));

            if (field.dataType === 'custom' && Array.isArray(field.children)) {
                field.children.forEach(function (definition) {
                    if (!definition.label) {
                        return;
                    }

                    lines.push('  ↳ ' + definition.label + ' → ' + ((definition.valueInput && definition.valueInput.value) || '—'));
                });
            }
        });
    }

    return lines.join('\n');
}

function copyInspection() {
    var text = getFormattedInspectionText();

    if (!text) {
        return;
    }

    var copyButton = document.getElementById('copyInspectionButton');
    var copiedText = function () {
        var buttonLabel = copyButton.querySelector('.button-label');
        buttonLabel.textContent = 'Kopyalandı';
        setTimeout(function () { buttonLabel.textContent = 'Kopyala'; }, 1600);
    };
    var copyWithFallback = function () {
        var temporaryInput = document.createElement('textarea');
        temporaryInput.value = text;
        temporaryInput.setAttribute('readonly', '');
        temporaryInput.style.position = 'fixed';
        temporaryInput.style.opacity = '0';
        document.body.appendChild(temporaryInput);
        temporaryInput.select();

        var copied = document.execCommand('copy');
        temporaryInput.remove();

        if (copied) {
            copiedText();
        }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(copiedText).catch(copyWithFallback);
        return;
    }

    copyWithFallback();
}

function setActiveField(fieldIndex) {
    clearActiveField();

    var field = idList[fieldIndex];
    var tableRow = getDefinitionRows(document.getElementById('highlightTable'))[fieldIndex];

    if (tableRow && field) {
        tableRow.classList.add('is-highlighted');
        tableRow.style.setProperty('--field-color', field.color);
    }

    document.querySelectorAll('.byte-cell--marked[data-field-index="' + fieldIndex + '"]').forEach(function (byteElement) {
        byteElement.classList.add('byte-cell--active');
    });
}

function clearActiveField() {
    document.querySelectorAll('#highlightTable tr.is-highlighted').forEach(function (tableRow) {
        tableRow.classList.remove('is-highlighted');
        tableRow.style.removeProperty('--field-color');
    });

    document.querySelectorAll('.byte-cell--active').forEach(function (byteElement) {
        byteElement.classList.remove('byte-cell--active');
    });
}

function updateConvertedValue() {

    // current text 
    var validation = parseHexInput(document.getElementById('myTextarea').value);
    var textArray = validation.valid ? validation.bytes : [];

    for (var i = 0; i < idList.length; i++) {
        var valueType = idList[i].dataType;

        if (!validation.valid) {
            idList[i].convertedValue = 'Geçersiz hex';
            continue;
        }

        if (!idList[i].rangeValid) {
            idList[i].convertedValue = 'Geçersiz aralık';
            continue;
        }

        // substring
        var willConvertedValue = textArray.slice(idList[i].startIndex, idList[i].endIndex);
        var convertedValue = '';
        var hexValue = willConvertedValue.join('');

        if (/^(u?int)(8|16|32|64)$/.test(valueType)) {
            convertedValue = decodeIntegerBytes(willConvertedValue, valueType);
        }
        else if (valueType == 'float') {
            convertedValue = decodeFloatingBytes(willConvertedValue, 'float');
        }
        else if (valueType == 'double') {
            convertedValue = decodeFloatingBytes(willConvertedValue, 'double');
        }
        else if (valueType == 'char') {
            convertedValue = willConvertedValue.length === 1
                ? String.fromCharCode(parseInt(willConvertedValue[0], 16))
                : 'Geçersiz uzunluk';
        }
        else if (valueType == 'ascii') {
            // example 41 42 = AB
            for (var j = 0; j < willConvertedValue.length; j++) {
                convertedValue += String.fromCharCode(parseInt(willConvertedValue[j], 16));
            }
        }
        else if (valueType == 'hex') {
            convertedValue = '0x' + hexValue.toUpperCase();
        }
        else if (valueType == 'bits') {
            convertedValue = '0x' + hexValue.toUpperCase();
        }
        else if (valueType == 'custom') {
            convertedValue = '0x' + hexValue.toUpperCase();
        }
        else if (valueType == 'epochUtc') {
            if (willConvertedValue.length !== 4) {
                convertedValue = 'Geçersiz uzunluk';
            } else {
                var epochSeconds = parseInt(hexValue, 16);
                convertedValue = new Date(epochSeconds * 1000).toISOString().replace('.000Z', 'Z');
            }
        }
        else if (valueType == 'mac') {
            convertedValue = willConvertedValue.length === 6 ? willConvertedValue.join(':').toUpperCase() : 'Geçersiz MAC';
        }
        else if (valueType == 'ipv4') {
            convertedValue = willConvertedValue.length === 4
                ? willConvertedValue.map(function (byte) { return parseInt(byte, 16); }).join('.')
                : 'Geçersiz IPv4';
        }
        else if (valueType == 'protocol') {
            var protocolNumber = parseInt(hexValue, 16);
            var protocols = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' };
            convertedValue = (protocols[protocolNumber] || 'Bilinmeyen') + ' (' + protocolNumber + ')';
        }
        else if (valueType == 'udpLength') {
            var ipProtocol = textArray[23] ? parseInt(textArray[23], 16) : NaN;
            convertedValue = ipProtocol === 17 ? parseInt(hexValue, 16) + ' byte' : 'UDP değil';
        }

        idList[i].convertedValue = convertedValue;
        console.log("converted value:" + idList[i].convertedValue)
    }

    // update table
    var fieldRows = getDefinitionRows(document.getElementById('highlightTable'));

    for (var i = 0; i < fieldRows.length; i++) {
        fieldRows[i].cells[6].children[0].value = idList[i].convertedValue;
    }
}

function updateBitDefinitionValues() {
    var validation = parseHexInput(document.getElementById('myTextarea').value);
    var textArray = validation.valid ? validation.bytes : [];

    idList.forEach(function (field) {
        if (field.dataType !== 'custom') return;

        if (!validation.valid || !field.rangeValid) {
            field.children.forEach(function (definition) {
                definition.valueInput.value = validation.valid ? 'Geçersiz aralık' : 'Geçersiz hex';
                setChildRangeState(definition, true);
            });
            return;
        }

        var byteRange = textArray.slice(Number(field.startIndex), Number(field.endIndex));
        var bitString = byteRange.map(function (byte) { return parseInt(byte, 16).toString(2).padStart(8, '0'); }).join('');

        field.children.forEach(function (definition) {
            if (!Number.isInteger(definition.start) || !Number.isInteger(definition.end) || definition.start < 0 || definition.end <= definition.start) {
                definition.valueInput.value = 'Geçersiz aralık';
                setChildRangeState(definition, true);
                return;
            }

            if (definition.scope === 'byte') {
                var childBytes = byteRange.slice(definition.start, definition.end);
                var byteRangeValid = childBytes.length === definition.end - definition.start;
                definition.valueInput.value = byteRangeValid ? convertChildBytes(childBytes, definition.type) : 'Geçersiz aralık';
                setChildRangeState(definition, !byteRangeValid);
                return;
            }

            if (definition.end > bitString.length) {
                definition.valueInput.value = 'Geçersiz aralık';
                setChildRangeState(definition, true);
                return;
            }

            var selectedBits = bitString.slice(definition.start, definition.end);
            if (definition.type === 'bits') {
                definition.valueInput.value = '0b' + selectedBits;
                setChildRangeState(definition, false);
                return;
            }

            definition.valueInput.value = BigInt('0b' + selectedBits).toString();
            setChildRangeState(definition, false);
        });
    });
}

function convertChildBytes(bytes, type) {
    var hex = bytes.join('');
    if (type === 'hex') return '0x' + hex.toUpperCase();
    if (type === 'bits') return '0b' + bytes.map(function (byte) { return parseInt(byte, 16).toString(2).padStart(8, '0'); }).join('');
    if (type === 'ascii') return bytes.map(function (byte) { return String.fromCharCode(parseInt(byte, 16)); }).join('');
    if (type === 'char') return bytes.length === 1 ? String.fromCharCode(parseInt(bytes[0], 16)) : 'Geçersiz uzunluk';
    if (type === 'mac') return bytes.length === 6 ? bytes.join(':').toUpperCase() : 'Geçersiz MAC';
    if (type === 'ipv4') return bytes.length === 4 ? bytes.map(function (byte) { return parseInt(byte, 16); }).join('.') : 'Geçersiz IPv4';
    if (type === 'epochUtc') return bytes.length === 4 ? new Date(parseInt(hex, 16) * 1000).toISOString().replace('.000Z', 'Z') : 'Geçersiz uzunluk';
    var integerType = /^(u?int)(8|16|32|64)$/.exec(type);
    if (integerType) {
        var bitSize = BigInt(integerType[2]);
        var integerValue = BigInt('0x' + (hex || '0'));
        if (integerType[1] === 'int' && integerValue >= (1n << (bitSize - 1n))) {
            integerValue -= 1n << bitSize;
        }
        return integerValue.toString();
    }
    return '0x' + hex.toUpperCase();
}

function setChildRangeState(definition, invalid) {
    if (!definition.element) {
        return;
    }

    definition.element.querySelectorAll('[data-bit-start], [data-bit-end], [data-bit-value]').forEach(function (input) {
        input.classList.toggle('is-invalid', invalid);
    });
}

function analyze() {
    console.log('[+] Analyze function');

    // tabloyara göre idList oluştur
    idList = [];

    var table = document.getElementById('highlightTable');
    var fieldRows = getDefinitionRows(table);
    var hexValidation = parseHexInput(document.getElementById('myTextarea').value);
    var byteLength = hexValidation.valid ? hexValidation.bytes.length : 0;

    setHexValidationState(hexValidation);

    for (var i = 0; i < fieldRows.length; i++) {
        var row = fieldRows[i];
        row.cells[0].textContent = i + 1;
        var startInput = row.cells[3].children[0];
        var endInput = row.cells[4].children[0];
        var startIndex = Number(startInput.value);
        var endIndex = Number(endInput.value);
        var rangeValid = Number.isInteger(startIndex) && Number.isInteger(endIndex)
            && startIndex >= 0 && endIndex > startIndex && endIndex <= byteLength;
        var rangeMessage = rangeValid ? '' : 'Aralık [başlangıç, bitiş) veri sınırları içinde olmalı.';

        startInput.setCustomValidity(rangeMessage);
        endInput.setCustomValidity(rangeMessage);
        startInput.setAttribute('aria-invalid', String(!rangeValid));
        endInput.setAttribute('aria-invalid', String(!rangeValid));
        startInput.title = rangeMessage;
        endInput.title = rangeMessage;

        var id = {
            no: i + 1,
            label: row.cells[1].children[0].value,
            color: row.cells[2].children[0].value,
            startIndex: startIndex,
            endIndex: endIndex,
            rangeValid: rangeValid,
            dataType: row.cells[5].children[0].value,
            convertedValue: row.cells[6].children[0].value,
            children: Array.from(row.nextElementSibling.querySelectorAll('.bit-definition:not(.bit-definition--head)')).map(function (definition) {
                return {
                    element: definition,
                    label: definition.querySelector('[data-bit-label]').value.trim(),
                    scope: definition.querySelector('[data-child-scope]').value,
                    start: Number(definition.querySelector('[data-bit-start]').value),
                    end: Number(definition.querySelector('[data-bit-end]').value),
                    type: definition.querySelector('[data-bit-type]').value,
                    valueInput: definition.querySelector('[data-bit-value]')
                };
            })
        }
        idList.push(id);
    }

    updateConvertedValue();
    updateBitDefinitionValues();
    highlightText();
}

function clearContent() {
    console.log('[+] Clear');

    // clear table
    var table = document.getElementById('highlightTable');
    var rowCount = table.rows.length;

    for (var i = 1; i < rowCount; i++) {
        table.deleteRow(1);
    }

    // clear textarea
    document.getElementById('myTextarea').value = '';
    document.getElementById('presetSelect').value = '';
    analyze();
}

function test() {
    console.log('test');

}


function changedValuesApplyChanges() {
    console.log('[+] changedValuesApplyChanges');

    analyze();
}

var inspectionResizeTimer;
window.addEventListener('resize', function () {
    clearTimeout(inspectionResizeTimer);
    inspectionResizeTimer = setTimeout(analyze, 120);
});

function loadSchemaFromHash() {
    if (location.hash.indexOf('schema=') === -1) return;
    try {
        var schema = HexSchemaTools.decodeHash(location.hash);
        clearDefinitions();
        document.getElementById('endianSelect').value = schema.endian;
        schema.fields.forEach(function (field, index) {
            addNewIdentifier(normalizeImportedField({
                label: field.name,
                color: field.color,
                startIndex: field.offset,
                endIndex: Number(field.offset) + Number(field.length),
                dataType: field.type,
                children: (field.children || []).map(function (child) {
                    return { label: child.name, scope: child.scope || 'byte', start: child.offset, end: child.offset + child.length, type: child.type };
                })
            }, index));
        });
        analyze();
        setToolOutput('schemaResult', 'URL içindeki schema açıldı.');
    } catch (error) { setToolOutput('schemaResult', 'Schema linki açılamadı: ' + error.message); }
}

HexInputTools.initDropZone({
    target: document.querySelector('.input-panel'),
    onBytes: function (loaded, detail) {
        var packets = Array.isArray(loaded) ? loaded : null;
        var bytes = packets ? packets[0] : loaded;
        if (!bytes) return setHexValidationState({ valid: false, message: 'Dosyada paket bulunamadı.' });
        document.getElementById('myTextarea').value = HexInputTools.bytesToHex(bytes);
        document.getElementById('inputFormat').value = 'hex';
        document.getElementById('presetSelect').value = '';
        analyze();
        if (packets) document.getElementById('inputFeedback').textContent = detail.file.name + ': ' + packets.length + ' paket bulundu; ilk paket açıldı.';
    },
    onError: function (error) { setHexValidationState({ valid: false, message: error.message }); }
});

loadSchemaFromHash();

// call function when page loaded
window.onload = function () {

    console.log('Page loaded');

    setTimeout(function () {
        console.log('Timeout');
         // show content
         document.getElementsByClassName('content')[0].style.display = 'block';
         // hide loading
         document.getElementsByClassName('loader')[0].style.display = 'none';
    }, 2000);
}
