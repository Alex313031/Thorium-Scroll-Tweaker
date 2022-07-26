(function () {
    'use strict';

    var Settings_Mode;
    (function (Settings_Mode) {
        /* set these enum values to string values to be able to use them as strings too */
        Settings_Mode["Always"] = "Always";
        Settings_Mode["OnTriggerKeyPressed"] = "OnTriggerKeyPressed";
    })(Settings_Mode || (Settings_Mode = {}));
    var Settings_TriggerKey;
    (function (Settings_TriggerKey) {
        /* set these enum values to string values to be able to use them as strings too */
        Settings_TriggerKey["AltLeft"] = "AltLeft";
        Settings_TriggerKey["ShiftLeft"] = "ShiftLeft";
        Settings_TriggerKey["ControlLeft"] = "ControlLeft";
    })(Settings_TriggerKey || (Settings_TriggerKey = {}));
    var Settings = /** @class */ (function () {
        function Settings() {
        }
        Settings.Mode = Settings_Mode; // allows client files to write `Settings.Mode`
        Settings.TriggerKey = Settings_TriggerKey; // allows client files to write `Settings.TriggerKey`
        return Settings;
    }());

    var defaultSettings = {
        mode: Settings.Mode.OnTriggerKeyPressed,
        scrollSpeedMultiplier: 3,
        triggerKey: Settings.TriggerKey.AltLeft,
        ignoredUrls: []
    };

    var global$1 = (typeof global !== "undefined" ? global :
                typeof self !== "undefined" ? self :
                typeof window !== "undefined" ? window : {});

    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
    var inited = false;
    function init () {
      inited = true;
      var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      for (var i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }

      revLookup['-'.charCodeAt(0)] = 62;
      revLookup['_'.charCodeAt(0)] = 63;
    }

    function toByteArray (b64) {
      if (!inited) {
        init();
      }
      var i, j, l, tmp, placeHolders, arr;
      var len = b64.length;

      if (len % 4 > 0) {
        throw new Error('Invalid string. Length must be a multiple of 4')
      }

      // the number of equal signs (place holders)
      // if there are two placeholders, than the two characters before it
      // represent one byte
      // if there is only one, then the three characters before it represent 2 bytes
      // this is just a cheap hack to not do indexOf twice
      placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

      // base64 is 4/3 + up to two characters of the original data
      arr = new Arr(len * 3 / 4 - placeHolders);

      // if there are placeholders, only get up to the last complete 4 chars
      l = placeHolders > 0 ? len - 4 : len;

      var L = 0;

      for (i = 0, j = 0; i < l; i += 4, j += 3) {
        tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
        arr[L++] = (tmp >> 16) & 0xFF;
        arr[L++] = (tmp >> 8) & 0xFF;
        arr[L++] = tmp & 0xFF;
      }

      if (placeHolders === 2) {
        tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
        arr[L++] = tmp & 0xFF;
      } else if (placeHolders === 1) {
        tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
        arr[L++] = (tmp >> 8) & 0xFF;
        arr[L++] = tmp & 0xFF;
      }

      return arr
    }

    function tripletToBase64 (num) {
      return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
    }

    function encodeChunk (uint8, start, end) {
      var tmp;
      var output = [];
      for (var i = start; i < end; i += 3) {
        tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
        output.push(tripletToBase64(tmp));
      }
      return output.join('')
    }

    function fromByteArray (uint8) {
      if (!inited) {
        init();
      }
      var tmp;
      var len = uint8.length;
      var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
      var output = '';
      var parts = [];
      var maxChunkLength = 16383; // must be multiple of 3

      // go through the array every three bytes, we'll deal with trailing stuff later
      for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
        parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
      }

      // pad the end with zeros, but make sure to not forget the extra bytes
      if (extraBytes === 1) {
        tmp = uint8[len - 1];
        output += lookup[tmp >> 2];
        output += lookup[(tmp << 4) & 0x3F];
        output += '==';
      } else if (extraBytes === 2) {
        tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
        output += lookup[tmp >> 10];
        output += lookup[(tmp >> 4) & 0x3F];
        output += lookup[(tmp << 2) & 0x3F];
        output += '=';
      }

      parts.push(output);

      return parts.join('')
    }

    function read (buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? (nBytes - 1) : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];

      i += d;

      e = s & ((1 << (-nBits)) - 1);
      s >>= (-nBits);
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

      m = e & ((1 << (-nBits)) - 1);
      e >>= (-nBits);
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : ((s ? -1 : 1) * Infinity)
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
    }

    function write (buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
      var i = isLE ? 0 : (nBytes - 1);
      var d = isLE ? 1 : -1;
      var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

      value = Math.abs(value);

      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }

        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }

      for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

      e = (e << mLen) | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

      buffer[offset + i - d] |= s * 128;
    }

    var toString = {}.toString;

    var isArray = Array.isArray || function (arr) {
      return toString.call(arr) == '[object Array]';
    };

    var INSPECT_MAX_BYTES = 50;

    /**
     * If `Buffer.TYPED_ARRAY_SUPPORT`:
     *   === true    Use Uint8Array implementation (fastest)
     *   === false   Use Object implementation (most compatible, even IE6)
     *
     * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
     * Opera 11.6+, iOS 4.2+.
     *
     * Due to various browser bugs, sometimes the Object implementation will be used even
     * when the browser supports typed arrays.
     *
     * Note:
     *
     *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
     *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
     *
     *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
     *
     *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
     *     incorrect length in some situations.

     * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
     * get the Object implementation, which is slower but behaves correctly.
     */
    Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
      ? global$1.TYPED_ARRAY_SUPPORT
      : true;

    function kMaxLength () {
      return Buffer.TYPED_ARRAY_SUPPORT
        ? 0x7fffffff
        : 0x3fffffff
    }

    function createBuffer (that, length) {
      if (kMaxLength() < length) {
        throw new RangeError('Invalid typed array length')
      }
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        // Return an augmented `Uint8Array` instance, for best performance
        that = new Uint8Array(length);
        that.__proto__ = Buffer.prototype;
      } else {
        // Fallback: Return an object instance of the Buffer class
        if (that === null) {
          that = new Buffer(length);
        }
        that.length = length;
      }

      return that
    }

    /**
     * The Buffer constructor returns instances of `Uint8Array` that have their
     * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
     * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
     * and the `Uint8Array` methods. Square bracket notation works as expected -- it
     * returns a single octet.
     *
     * The `Uint8Array` prototype remains unmodified.
     */

    function Buffer (arg, encodingOrOffset, length) {
      if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
        return new Buffer(arg, encodingOrOffset, length)
      }

      // Common case.
      if (typeof arg === 'number') {
        if (typeof encodingOrOffset === 'string') {
          throw new Error(
            'If encoding is specified then the first argument must be a string'
          )
        }
        return allocUnsafe(this, arg)
      }
      return from(this, arg, encodingOrOffset, length)
    }

    Buffer.poolSize = 8192; // not used by this implementation

    // TODO: Legacy, not needed anymore. Remove in next major version.
    Buffer._augment = function (arr) {
      arr.__proto__ = Buffer.prototype;
      return arr
    };

    function from (that, value, encodingOrOffset, length) {
      if (typeof value === 'number') {
        throw new TypeError('"value" argument must not be a number')
      }

      if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
        return fromArrayBuffer(that, value, encodingOrOffset, length)
      }

      if (typeof value === 'string') {
        return fromString(that, value, encodingOrOffset)
      }

      return fromObject(that, value)
    }

    /**
     * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
     * if value is a number.
     * Buffer.from(str[, encoding])
     * Buffer.from(array)
     * Buffer.from(buffer)
     * Buffer.from(arrayBuffer[, byteOffset[, length]])
     **/
    Buffer.from = function (value, encodingOrOffset, length) {
      return from(null, value, encodingOrOffset, length)
    };

    if (Buffer.TYPED_ARRAY_SUPPORT) {
      Buffer.prototype.__proto__ = Uint8Array.prototype;
      Buffer.__proto__ = Uint8Array;
    }

    function assertSize (size) {
      if (typeof size !== 'number') {
        throw new TypeError('"size" argument must be a number')
      } else if (size < 0) {
        throw new RangeError('"size" argument must not be negative')
      }
    }

    function alloc (that, size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(that, size)
      }
      if (fill !== undefined) {
        // Only pay attention to encoding if it's a string. This
        // prevents accidentally sending in a number that would
        // be interpretted as a start offset.
        return typeof encoding === 'string'
          ? createBuffer(that, size).fill(fill, encoding)
          : createBuffer(that, size).fill(fill)
      }
      return createBuffer(that, size)
    }

    /**
     * Creates a new filled Buffer instance.
     * alloc(size[, fill[, encoding]])
     **/
    Buffer.alloc = function (size, fill, encoding) {
      return alloc(null, size, fill, encoding)
    };

    function allocUnsafe (that, size) {
      assertSize(size);
      that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
      if (!Buffer.TYPED_ARRAY_SUPPORT) {
        for (var i = 0; i < size; ++i) {
          that[i] = 0;
        }
      }
      return that
    }

    /**
     * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
     * */
    Buffer.allocUnsafe = function (size) {
      return allocUnsafe(null, size)
    };
    /**
     * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
     */
    Buffer.allocUnsafeSlow = function (size) {
      return allocUnsafe(null, size)
    };

    function fromString (that, string, encoding) {
      if (typeof encoding !== 'string' || encoding === '') {
        encoding = 'utf8';
      }

      if (!Buffer.isEncoding(encoding)) {
        throw new TypeError('"encoding" must be a valid string encoding')
      }

      var length = byteLength(string, encoding) | 0;
      that = createBuffer(that, length);

      var actual = that.write(string, encoding);

      if (actual !== length) {
        // Writing a hex string, for example, that contains invalid characters will
        // cause everything after the first invalid character to be ignored. (e.g.
        // 'abxxcd' will be treated as 'ab')
        that = that.slice(0, actual);
      }

      return that
    }

    function fromArrayLike (that, array) {
      var length = array.length < 0 ? 0 : checked(array.length) | 0;
      that = createBuffer(that, length);
      for (var i = 0; i < length; i += 1) {
        that[i] = array[i] & 255;
      }
      return that
    }

    function fromArrayBuffer (that, array, byteOffset, length) {
      array.byteLength; // this throws if `array` is not a valid ArrayBuffer

      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('\'offset\' is out of bounds')
      }

      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('\'length\' is out of bounds')
      }

      if (byteOffset === undefined && length === undefined) {
        array = new Uint8Array(array);
      } else if (length === undefined) {
        array = new Uint8Array(array, byteOffset);
      } else {
        array = new Uint8Array(array, byteOffset, length);
      }

      if (Buffer.TYPED_ARRAY_SUPPORT) {
        // Return an augmented `Uint8Array` instance, for best performance
        that = array;
        that.__proto__ = Buffer.prototype;
      } else {
        // Fallback: Return an object instance of the Buffer class
        that = fromArrayLike(that, array);
      }
      return that
    }

    function fromObject (that, obj) {
      if (internalIsBuffer(obj)) {
        var len = checked(obj.length) | 0;
        that = createBuffer(that, len);

        if (that.length === 0) {
          return that
        }

        obj.copy(that, 0, 0, len);
        return that
      }

      if (obj) {
        if ((typeof ArrayBuffer !== 'undefined' &&
            obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
          if (typeof obj.length !== 'number' || isnan(obj.length)) {
            return createBuffer(that, 0)
          }
          return fromArrayLike(that, obj)
        }

        if (obj.type === 'Buffer' && isArray(obj.data)) {
          return fromArrayLike(that, obj.data)
        }
      }

      throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
    }

    function checked (length) {
      // Note: cannot use `length < kMaxLength()` here because that fails when
      // length is NaN (which is otherwise coerced to zero.)
      if (length >= kMaxLength()) {
        throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                             'size: 0x' + kMaxLength().toString(16) + ' bytes')
      }
      return length | 0
    }
    Buffer.isBuffer = isBuffer;
    function internalIsBuffer (b) {
      return !!(b != null && b._isBuffer)
    }

    Buffer.compare = function compare (a, b) {
      if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
        throw new TypeError('Arguments must be Buffers')
      }

      if (a === b) return 0

      var x = a.length;
      var y = b.length;

      for (var i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break
        }
      }

      if (x < y) return -1
      if (y < x) return 1
      return 0
    };

    Buffer.isEncoding = function isEncoding (encoding) {
      switch (String(encoding).toLowerCase()) {
        case 'hex':
        case 'utf8':
        case 'utf-8':
        case 'ascii':
        case 'latin1':
        case 'binary':
        case 'base64':
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return true
        default:
          return false
      }
    };

    Buffer.concat = function concat (list, length) {
      if (!isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }

      if (list.length === 0) {
        return Buffer.alloc(0)
      }

      var i;
      if (length === undefined) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }

      var buffer = Buffer.allocUnsafe(length);
      var pos = 0;
      for (i = 0; i < list.length; ++i) {
        var buf = list[i];
        if (!internalIsBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers')
        }
        buf.copy(buffer, pos);
        pos += buf.length;
      }
      return buffer
    };

    function byteLength (string, encoding) {
      if (internalIsBuffer(string)) {
        return string.length
      }
      if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
          (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
        return string.byteLength
      }
      if (typeof string !== 'string') {
        string = '' + string;
      }

      var len = string.length;
      if (len === 0) return 0

      // Use a for loop to avoid recursion
      var loweredCase = false;
      for (;;) {
        switch (encoding) {
          case 'ascii':
          case 'latin1':
          case 'binary':
            return len
          case 'utf8':
          case 'utf-8':
          case undefined:
            return utf8ToBytes(string).length
          case 'ucs2':
          case 'ucs-2':
          case 'utf16le':
          case 'utf-16le':
            return len * 2
          case 'hex':
            return len >>> 1
          case 'base64':
            return base64ToBytes(string).length
          default:
            if (loweredCase) return utf8ToBytes(string).length // assume utf8
            encoding = ('' + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer.byteLength = byteLength;

    function slowToString (encoding, start, end) {
      var loweredCase = false;

      // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
      // property of a typed array.

      // This behaves neither like String nor Uint8Array in that we set start/end
      // to their upper/lower bounds if the value passed is out of range.
      // undefined is handled specially as per ECMA-262 6th Edition,
      // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
      if (start === undefined || start < 0) {
        start = 0;
      }
      // Return early if start > this.length. Done here to prevent potential uint32
      // coercion fail below.
      if (start > this.length) {
        return ''
      }

      if (end === undefined || end > this.length) {
        end = this.length;
      }

      if (end <= 0) {
        return ''
      }

      // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
      end >>>= 0;
      start >>>= 0;

      if (end <= start) {
        return ''
      }

      if (!encoding) encoding = 'utf8';

      while (true) {
        switch (encoding) {
          case 'hex':
            return hexSlice(this, start, end)

          case 'utf8':
          case 'utf-8':
            return utf8Slice(this, start, end)

          case 'ascii':
            return asciiSlice(this, start, end)

          case 'latin1':
          case 'binary':
            return latin1Slice(this, start, end)

          case 'base64':
            return base64Slice(this, start, end)

          case 'ucs2':
          case 'ucs-2':
          case 'utf16le':
          case 'utf-16le':
            return utf16leSlice(this, start, end)

          default:
            if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
            encoding = (encoding + '').toLowerCase();
            loweredCase = true;
        }
      }
    }

    // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
    // Buffer instances.
    Buffer.prototype._isBuffer = true;

    function swap (b, n, m) {
      var i = b[n];
      b[n] = b[m];
      b[m] = i;
    }

    Buffer.prototype.swap16 = function swap16 () {
      var len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError('Buffer size must be a multiple of 16-bits')
      }
      for (var i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this
    };

    Buffer.prototype.swap32 = function swap32 () {
      var len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError('Buffer size must be a multiple of 32-bits')
      }
      for (var i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this
    };

    Buffer.prototype.swap64 = function swap64 () {
      var len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError('Buffer size must be a multiple of 64-bits')
      }
      for (var i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this
    };

    Buffer.prototype.toString = function toString () {
      var length = this.length | 0;
      if (length === 0) return ''
      if (arguments.length === 0) return utf8Slice(this, 0, length)
      return slowToString.apply(this, arguments)
    };

    Buffer.prototype.equals = function equals (b) {
      if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
      if (this === b) return true
      return Buffer.compare(this, b) === 0
    };

    Buffer.prototype.inspect = function inspect () {
      var str = '';
      var max = INSPECT_MAX_BYTES;
      if (this.length > 0) {
        str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
        if (this.length > max) str += ' ... ';
      }
      return '<Buffer ' + str + '>'
    };

    Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
      if (!internalIsBuffer(target)) {
        throw new TypeError('Argument must be a Buffer')
      }

      if (start === undefined) {
        start = 0;
      }
      if (end === undefined) {
        end = target ? target.length : 0;
      }
      if (thisStart === undefined) {
        thisStart = 0;
      }
      if (thisEnd === undefined) {
        thisEnd = this.length;
      }

      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError('out of range index')
      }

      if (thisStart >= thisEnd && start >= end) {
        return 0
      }
      if (thisStart >= thisEnd) {
        return -1
      }
      if (start >= end) {
        return 1
      }

      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;

      if (this === target) return 0

      var x = thisEnd - thisStart;
      var y = end - start;
      var len = Math.min(x, y);

      var thisCopy = this.slice(thisStart, thisEnd);
      var targetCopy = target.slice(start, end);

      for (var i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break
        }
      }

      if (x < y) return -1
      if (y < x) return 1
      return 0
    };

    // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
    // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
    //
    // Arguments:
    // - buffer - a Buffer to search
    // - val - a string, Buffer, or number
    // - byteOffset - an index into `buffer`; will be clamped to an int32
    // - encoding - an optional encoding, relevant is val is a string
    // - dir - true for indexOf, false for lastIndexOf
    function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
      // Empty buffer means no match
      if (buffer.length === 0) return -1

      // Normalize byteOffset
      if (typeof byteOffset === 'string') {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 0x7fffffff) {
        byteOffset = 0x7fffffff;
      } else if (byteOffset < -0x80000000) {
        byteOffset = -0x80000000;
      }
      byteOffset = +byteOffset;  // Coerce to Number.
      if (isNaN(byteOffset)) {
        // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
        byteOffset = dir ? 0 : (buffer.length - 1);
      }

      // Normalize byteOffset: negative offsets start from the end of the buffer
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1
      }

      // Normalize val
      if (typeof val === 'string') {
        val = Buffer.from(val, encoding);
      }

      // Finally, search either indexOf (if dir is true) or lastIndexOf
      if (internalIsBuffer(val)) {
        // Special case: looking for empty string/buffer always fails
        if (val.length === 0) {
          return -1
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
      } else if (typeof val === 'number') {
        val = val & 0xFF; // Search for a byte value [0-255]
        if (Buffer.TYPED_ARRAY_SUPPORT &&
            typeof Uint8Array.prototype.indexOf === 'function') {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
          }
        }
        return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
      }

      throw new TypeError('val must be string, number or Buffer')
    }

    function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
      var indexSize = 1;
      var arrLength = arr.length;
      var valLength = val.length;

      if (encoding !== undefined) {
        encoding = String(encoding).toLowerCase();
        if (encoding === 'ucs2' || encoding === 'ucs-2' ||
            encoding === 'utf16le' || encoding === 'utf-16le') {
          if (arr.length < 2 || val.length < 2) {
            return -1
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }

      function read (buf, i) {
        if (indexSize === 1) {
          return buf[i]
        } else {
          return buf.readUInt16BE(i * indexSize)
        }
      }

      var i;
      if (dir) {
        var foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          var found = true;
          for (var j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break
            }
          }
          if (found) return i
        }
      }

      return -1
    }

    Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1
    };

    Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
    };

    Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
    };

    function hexWrite (buf, string, offset, length) {
      offset = Number(offset) || 0;
      var remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }

      // must be an even number of digits
      var strLen = string.length;
      if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

      if (length > strLen / 2) {
        length = strLen / 2;
      }
      for (var i = 0; i < length; ++i) {
        var parsed = parseInt(string.substr(i * 2, 2), 16);
        if (isNaN(parsed)) return i
        buf[offset + i] = parsed;
      }
      return i
    }

    function utf8Write (buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
    }

    function asciiWrite (buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length)
    }

    function latin1Write (buf, string, offset, length) {
      return asciiWrite(buf, string, offset, length)
    }

    function base64Write (buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length)
    }

    function ucs2Write (buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
    }

    Buffer.prototype.write = function write (string, offset, length, encoding) {
      // Buffer#write(string)
      if (offset === undefined) {
        encoding = 'utf8';
        length = this.length;
        offset = 0;
      // Buffer#write(string, encoding)
      } else if (length === undefined && typeof offset === 'string') {
        encoding = offset;
        length = this.length;
        offset = 0;
      // Buffer#write(string, offset[, length][, encoding])
      } else if (isFinite(offset)) {
        offset = offset | 0;
        if (isFinite(length)) {
          length = length | 0;
          if (encoding === undefined) encoding = 'utf8';
        } else {
          encoding = length;
          length = undefined;
        }
      // legacy write(string, encoding, offset, length) - remove in v0.13
      } else {
        throw new Error(
          'Buffer.write(string, encoding, offset[, length]) is no longer supported'
        )
      }

      var remaining = this.length - offset;
      if (length === undefined || length > remaining) length = remaining;

      if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
        throw new RangeError('Attempt to write outside buffer bounds')
      }

      if (!encoding) encoding = 'utf8';

      var loweredCase = false;
      for (;;) {
        switch (encoding) {
          case 'hex':
            return hexWrite(this, string, offset, length)

          case 'utf8':
          case 'utf-8':
            return utf8Write(this, string, offset, length)

          case 'ascii':
            return asciiWrite(this, string, offset, length)

          case 'latin1':
          case 'binary':
            return latin1Write(this, string, offset, length)

          case 'base64':
            // Warning: maxLength not taken into account in base64Write
            return base64Write(this, string, offset, length)

          case 'ucs2':
          case 'ucs-2':
          case 'utf16le':
          case 'utf-16le':
            return ucs2Write(this, string, offset, length)

          default:
            if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
            encoding = ('' + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };

    Buffer.prototype.toJSON = function toJSON () {
      return {
        type: 'Buffer',
        data: Array.prototype.slice.call(this._arr || this, 0)
      }
    };

    function base64Slice (buf, start, end) {
      if (start === 0 && end === buf.length) {
        return fromByteArray(buf)
      } else {
        return fromByteArray(buf.slice(start, end))
      }
    }

    function utf8Slice (buf, start, end) {
      end = Math.min(buf.length, end);
      var res = [];

      var i = start;
      while (i < end) {
        var firstByte = buf[i];
        var codePoint = null;
        var bytesPerSequence = (firstByte > 0xEF) ? 4
          : (firstByte > 0xDF) ? 3
          : (firstByte > 0xBF) ? 2
          : 1;

        if (i + bytesPerSequence <= end) {
          var secondByte, thirdByte, fourthByte, tempCodePoint;

          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 0x80) {
                codePoint = firstByte;
              }
              break
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 0xC0) === 0x80) {
                tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
                if (tempCodePoint > 0x7F) {
                  codePoint = tempCodePoint;
                }
              }
              break
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
                if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                  codePoint = tempCodePoint;
                }
              }
              break
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
                if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }

        if (codePoint === null) {
          // we did not generate a valid codePoint so insert a
          // replacement char (U+FFFD) and advance only 1 byte
          codePoint = 0xFFFD;
          bytesPerSequence = 1;
        } else if (codePoint > 0xFFFF) {
          // encode to utf16 (surrogate pair dance)
          codePoint -= 0x10000;
          res.push(codePoint >>> 10 & 0x3FF | 0xD800);
          codePoint = 0xDC00 | codePoint & 0x3FF;
        }

        res.push(codePoint);
        i += bytesPerSequence;
      }

      return decodeCodePointsArray(res)
    }

    // Based on http://stackoverflow.com/a/22747272/680742, the browser with
    // the lowest limit is Chrome, with 0x10000 args.
    // We go 1 magnitude less, for safety
    var MAX_ARGUMENTS_LENGTH = 0x1000;

    function decodeCodePointsArray (codePoints) {
      var len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
      }

      // Decode in chunks to avoid "call stack size exceeded".
      var res = '';
      var i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res
    }

    function asciiSlice (buf, start, end) {
      var ret = '';
      end = Math.min(buf.length, end);

      for (var i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 0x7F);
      }
      return ret
    }

    function latin1Slice (buf, start, end) {
      var ret = '';
      end = Math.min(buf.length, end);

      for (var i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret
    }

    function hexSlice (buf, start, end) {
      var len = buf.length;

      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;

      var out = '';
      for (var i = start; i < end; ++i) {
        out += toHex(buf[i]);
      }
      return out
    }

    function utf16leSlice (buf, start, end) {
      var bytes = buf.slice(start, end);
      var res = '';
      for (var i = 0; i < bytes.length; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res
    }

    Buffer.prototype.slice = function slice (start, end) {
      var len = this.length;
      start = ~~start;
      end = end === undefined ? len : ~~end;

      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }

      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }

      if (end < start) end = start;

      var newBuf;
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        newBuf = this.subarray(start, end);
        newBuf.__proto__ = Buffer.prototype;
      } else {
        var sliceLen = end - start;
        newBuf = new Buffer(sliceLen, undefined);
        for (var i = 0; i < sliceLen; ++i) {
          newBuf[i] = this[i + start];
        }
      }

      return newBuf
    };

    /*
     * Need to make sure that buffer isn't trying to write out of bounds.
     */
    function checkOffset (offset, ext, length) {
      if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
      if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
    }

    Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
      offset = offset | 0;
      byteLength = byteLength | 0;
      if (!noAssert) checkOffset(offset, byteLength, this.length);

      var val = this[offset];
      var mul = 1;
      var i = 0;
      while (++i < byteLength && (mul *= 0x100)) {
        val += this[offset + i] * mul;
      }

      return val
    };

    Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
      offset = offset | 0;
      byteLength = byteLength | 0;
      if (!noAssert) {
        checkOffset(offset, byteLength, this.length);
      }

      var val = this[offset + --byteLength];
      var mul = 1;
      while (byteLength > 0 && (mul *= 0x100)) {
        val += this[offset + --byteLength] * mul;
      }

      return val
    };

    Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset]
    };

    Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | (this[offset + 1] << 8)
    };

    Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 2, this.length);
      return (this[offset] << 8) | this[offset + 1]
    };

    Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 4, this.length);

      return ((this[offset]) |
          (this[offset + 1] << 8) |
          (this[offset + 2] << 16)) +
          (this[offset + 3] * 0x1000000)
    };

    Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 4, this.length);

      return (this[offset] * 0x1000000) +
        ((this[offset + 1] << 16) |
        (this[offset + 2] << 8) |
        this[offset + 3])
    };

    Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
      offset = offset | 0;
      byteLength = byteLength | 0;
      if (!noAssert) checkOffset(offset, byteLength, this.length);

      var val = this[offset];
      var mul = 1;
      var i = 0;
      while (++i < byteLength && (mul *= 0x100)) {
        val += this[offset + i] * mul;
      }
      mul *= 0x80;

      if (val >= mul) val -= Math.pow(2, 8 * byteLength);

      return val
    };

    Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
      offset = offset | 0;
      byteLength = byteLength | 0;
      if (!noAssert) checkOffset(offset, byteLength, this.length);

      var i = byteLength;
      var mul = 1;
      var val = this[offset + --i];
      while (i > 0 && (mul *= 0x100)) {
        val += this[offset + --i] * mul;
      }
      mul *= 0x80;

      if (val >= mul) val -= Math.pow(2, 8 * byteLength);

      return val
    };

    Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 0x80)) return (this[offset])
      return ((0xff - this[offset] + 1) * -1)
    };

    Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 2, this.length);
      var val = this[offset] | (this[offset + 1] << 8);
      return (val & 0x8000) ? val | 0xFFFF0000 : val
    };

    Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 2, this.length);
      var val = this[offset + 1] | (this[offset] << 8);
      return (val & 0x8000) ? val | 0xFFFF0000 : val
    };

    Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 4, this.length);

      return (this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16) |
        (this[offset + 3] << 24)
    };

    Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 4, this.length);

      return (this[offset] << 24) |
        (this[offset + 1] << 16) |
        (this[offset + 2] << 8) |
        (this[offset + 3])
    };

    Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 4, this.length);
      return read(this, offset, true, 23, 4)
    };

    Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 4, this.length);
      return read(this, offset, false, 23, 4)
    };

    Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 8, this.length);
      return read(this, offset, true, 52, 8)
    };

    Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
      if (!noAssert) checkOffset(offset, 8, this.length);
      return read(this, offset, false, 52, 8)
    };

    function checkInt (buf, value, offset, ext, max, min) {
      if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
      if (offset + ext > buf.length) throw new RangeError('Index out of range')
    }

    Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
      value = +value;
      offset = offset | 0;
      byteLength = byteLength | 0;
      if (!noAssert) {
        var maxBytes = Math.pow(2, 8 * byteLength) - 1;
        checkInt(this, value, offset, byteLength, maxBytes, 0);
      }

      var mul = 1;
      var i = 0;
      this[offset] = value & 0xFF;
      while (++i < byteLength && (mul *= 0x100)) {
        this[offset + i] = (value / mul) & 0xFF;
      }

      return offset + byteLength
    };

    Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
      value = +value;
      offset = offset | 0;
      byteLength = byteLength | 0;
      if (!noAssert) {
        var maxBytes = Math.pow(2, 8 * byteLength) - 1;
        checkInt(this, value, offset, byteLength, maxBytes, 0);
      }

      var i = byteLength - 1;
      var mul = 1;
      this[offset + i] = value & 0xFF;
      while (--i >= 0 && (mul *= 0x100)) {
        this[offset + i] = (value / mul) & 0xFF;
      }

      return offset + byteLength
    };

    Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
      if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
      this[offset] = (value & 0xff);
      return offset + 1
    };

    function objectWriteUInt16 (buf, value, offset, littleEndian) {
      if (value < 0) value = 0xffff + value + 1;
      for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
        buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
          (littleEndian ? i : 1 - i) * 8;
      }
    }

    Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value & 0xff);
        this[offset + 1] = (value >>> 8);
      } else {
        objectWriteUInt16(this, value, offset, true);
      }
      return offset + 2
    };

    Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value >>> 8);
        this[offset + 1] = (value & 0xff);
      } else {
        objectWriteUInt16(this, value, offset, false);
      }
      return offset + 2
    };

    function objectWriteUInt32 (buf, value, offset, littleEndian) {
      if (value < 0) value = 0xffffffff + value + 1;
      for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
        buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
      }
    }

    Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset + 3] = (value >>> 24);
        this[offset + 2] = (value >>> 16);
        this[offset + 1] = (value >>> 8);
        this[offset] = (value & 0xff);
      } else {
        objectWriteUInt32(this, value, offset, true);
      }
      return offset + 4
    };

    Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value >>> 24);
        this[offset + 1] = (value >>> 16);
        this[offset + 2] = (value >>> 8);
        this[offset + 3] = (value & 0xff);
      } else {
        objectWriteUInt32(this, value, offset, false);
      }
      return offset + 4
    };

    Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) {
        var limit = Math.pow(2, 8 * byteLength - 1);

        checkInt(this, value, offset, byteLength, limit - 1, -limit);
      }

      var i = 0;
      var mul = 1;
      var sub = 0;
      this[offset] = value & 0xFF;
      while (++i < byteLength && (mul *= 0x100)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
      }

      return offset + byteLength
    };

    Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) {
        var limit = Math.pow(2, 8 * byteLength - 1);

        checkInt(this, value, offset, byteLength, limit - 1, -limit);
      }

      var i = byteLength - 1;
      var mul = 1;
      var sub = 0;
      this[offset + i] = value & 0xFF;
      while (--i >= 0 && (mul *= 0x100)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
      }

      return offset + byteLength
    };

    Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
      if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
      if (value < 0) value = 0xff + value + 1;
      this[offset] = (value & 0xff);
      return offset + 1
    };

    Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value & 0xff);
        this[offset + 1] = (value >>> 8);
      } else {
        objectWriteUInt16(this, value, offset, true);
      }
      return offset + 2
    };

    Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value >>> 8);
        this[offset + 1] = (value & 0xff);
      } else {
        objectWriteUInt16(this, value, offset, false);
      }
      return offset + 2
    };

    Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value & 0xff);
        this[offset + 1] = (value >>> 8);
        this[offset + 2] = (value >>> 16);
        this[offset + 3] = (value >>> 24);
      } else {
        objectWriteUInt32(this, value, offset, true);
      }
      return offset + 4
    };

    Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
      value = +value;
      offset = offset | 0;
      if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
      if (value < 0) value = 0xffffffff + value + 1;
      if (Buffer.TYPED_ARRAY_SUPPORT) {
        this[offset] = (value >>> 24);
        this[offset + 1] = (value >>> 16);
        this[offset + 2] = (value >>> 8);
        this[offset + 3] = (value & 0xff);
      } else {
        objectWriteUInt32(this, value, offset, false);
      }
      return offset + 4
    };

    function checkIEEE754 (buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError('Index out of range')
      if (offset < 0) throw new RangeError('Index out of range')
    }

    function writeFloat (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4);
      }
      write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4
    }

    Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert)
    };

    Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert)
    };

    function writeDouble (buf, value, offset, littleEndian, noAssert) {
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8);
      }
      write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8
    }

    Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert)
    };

    Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert)
    };

    // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
    Buffer.prototype.copy = function copy (target, targetStart, start, end) {
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;

      // Copy 0 bytes; we're done
      if (end === start) return 0
      if (target.length === 0 || this.length === 0) return 0

      // Fatal error conditions
      if (targetStart < 0) {
        throw new RangeError('targetStart out of bounds')
      }
      if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
      if (end < 0) throw new RangeError('sourceEnd out of bounds')

      // Are we oob?
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }

      var len = end - start;
      var i;

      if (this === target && start < targetStart && targetStart < end) {
        // descending copy from end
        for (i = len - 1; i >= 0; --i) {
          target[i + targetStart] = this[i + start];
        }
      } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
        // ascending copy from start
        for (i = 0; i < len; ++i) {
          target[i + targetStart] = this[i + start];
        }
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, start + len),
          targetStart
        );
      }

      return len
    };

    // Usage:
    //    buffer.fill(number[, offset[, end]])
    //    buffer.fill(buffer[, offset[, end]])
    //    buffer.fill(string[, offset[, end]][, encoding])
    Buffer.prototype.fill = function fill (val, start, end, encoding) {
      // Handle string cases:
      if (typeof val === 'string') {
        if (typeof start === 'string') {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === 'string') {
          encoding = end;
          end = this.length;
        }
        if (val.length === 1) {
          var code = val.charCodeAt(0);
          if (code < 256) {
            val = code;
          }
        }
        if (encoding !== undefined && typeof encoding !== 'string') {
          throw new TypeError('encoding must be a string')
        }
        if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
          throw new TypeError('Unknown encoding: ' + encoding)
        }
      } else if (typeof val === 'number') {
        val = val & 255;
      }

      // Invalid ranges are not set to a default, so can range check early.
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError('Out of range index')
      }

      if (end <= start) {
        return this
      }

      start = start >>> 0;
      end = end === undefined ? this.length : end >>> 0;

      if (!val) val = 0;

      var i;
      if (typeof val === 'number') {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        var bytes = internalIsBuffer(val)
          ? val
          : utf8ToBytes(new Buffer(val, encoding).toString());
        var len = bytes.length;
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }

      return this
    };

    // HELPER FUNCTIONS
    // ================

    var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

    function base64clean (str) {
      // Node strips out invalid characters like \n and \t from the string, base64-js does not
      str = stringtrim(str).replace(INVALID_BASE64_RE, '');
      // Node converts strings with length < 2 to ''
      if (str.length < 2) return ''
      // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
      while (str.length % 4 !== 0) {
        str = str + '=';
      }
      return str
    }

    function stringtrim (str) {
      if (str.trim) return str.trim()
      return str.replace(/^\s+|\s+$/g, '')
    }

    function toHex (n) {
      if (n < 16) return '0' + n.toString(16)
      return n.toString(16)
    }

    function utf8ToBytes (string, units) {
      units = units || Infinity;
      var codePoint;
      var length = string.length;
      var leadSurrogate = null;
      var bytes = [];

      for (var i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);

        // is surrogate component
        if (codePoint > 0xD7FF && codePoint < 0xE000) {
          // last char was a lead
          if (!leadSurrogate) {
            // no lead yet
            if (codePoint > 0xDBFF) {
              // unexpected trail
              if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
              continue
            } else if (i + 1 === length) {
              // unpaired lead
              if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
              continue
            }

            // valid lead
            leadSurrogate = codePoint;

            continue
          }

          // 2 leads in a row
          if (codePoint < 0xDC00) {
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            leadSurrogate = codePoint;
            continue
          }

          // valid surrogate pair
          codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
        } else if (leadSurrogate) {
          // valid bmp char, but last char was a lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        }

        leadSurrogate = null;

        // encode utf8
        if (codePoint < 0x80) {
          if ((units -= 1) < 0) break
          bytes.push(codePoint);
        } else if (codePoint < 0x800) {
          if ((units -= 2) < 0) break
          bytes.push(
            codePoint >> 0x6 | 0xC0,
            codePoint & 0x3F | 0x80
          );
        } else if (codePoint < 0x10000) {
          if ((units -= 3) < 0) break
          bytes.push(
            codePoint >> 0xC | 0xE0,
            codePoint >> 0x6 & 0x3F | 0x80,
            codePoint & 0x3F | 0x80
          );
        } else if (codePoint < 0x110000) {
          if ((units -= 4) < 0) break
          bytes.push(
            codePoint >> 0x12 | 0xF0,
            codePoint >> 0xC & 0x3F | 0x80,
            codePoint >> 0x6 & 0x3F | 0x80,
            codePoint & 0x3F | 0x80
          );
        } else {
          throw new Error('Invalid code point')
        }
      }

      return bytes
    }

    function asciiToBytes (str) {
      var byteArray = [];
      for (var i = 0; i < str.length; ++i) {
        // Node's code seems to be doing this and not & 0x7F..
        byteArray.push(str.charCodeAt(i) & 0xFF);
      }
      return byteArray
    }

    function utf16leToBytes (str, units) {
      var c, hi, lo;
      var byteArray = [];
      for (var i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break

        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }

      return byteArray
    }


    function base64ToBytes (str) {
      return toByteArray(base64clean(str))
    }

    function blitBuffer (src, dst, offset, length) {
      for (var i = 0; i < length; ++i) {
        if ((i + offset >= dst.length) || (i >= src.length)) break
        dst[i + offset] = src[i];
      }
      return i
    }

    function isnan (val) {
      return val !== val // eslint-disable-line no-self-compare
    }


    // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
    // The _isBuffer check is for Safari 5-7 support, because it's missing
    // Object.prototype.constructor. Remove this eventually
    function isBuffer(obj) {
      return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
    }

    function isFastBuffer (obj) {
      return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
    }

    // For Node v0.10 support. Remove this eventually.
    function isSlowBuffer (obj) {
      return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
    }

    // shim for using process in browser
    // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

    function defaultSetTimout() {
        throw new Error('setTimeout has not been defined');
    }
    function defaultClearTimeout () {
        throw new Error('clearTimeout has not been defined');
    }
    var cachedSetTimeout = defaultSetTimout;
    var cachedClearTimeout = defaultClearTimeout;
    if (typeof global$1.setTimeout === 'function') {
        cachedSetTimeout = setTimeout;
    }
    if (typeof global$1.clearTimeout === 'function') {
        cachedClearTimeout = clearTimeout;
    }

    function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
            //normal enviroments in sane situations
            return setTimeout(fun, 0);
        }
        // if setTimeout wasn't available but was latter defined
        if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
            cachedSetTimeout = setTimeout;
            return setTimeout(fun, 0);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedSetTimeout(fun, 0);
        } catch(e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                return cachedSetTimeout.call(null, fun, 0);
            } catch(e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                return cachedSetTimeout.call(this, fun, 0);
            }
        }


    }
    function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
            //normal enviroments in sane situations
            return clearTimeout(marker);
        }
        // if clearTimeout wasn't available but was latter defined
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
            cachedClearTimeout = clearTimeout;
            return clearTimeout(marker);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedClearTimeout(marker);
        } catch (e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                return cachedClearTimeout.call(null, marker);
            } catch (e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                return cachedClearTimeout.call(this, marker);
            }
        }



    }
    var queue = [];
    var draining = false;
    var currentQueue;
    var queueIndex = -1;

    function cleanUpNextTick() {
        if (!draining || !currentQueue) {
            return;
        }
        draining = false;
        if (currentQueue.length) {
            queue = currentQueue.concat(queue);
        } else {
            queueIndex = -1;
        }
        if (queue.length) {
            drainQueue();
        }
    }

    function drainQueue() {
        if (draining) {
            return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;

        var len = queue.length;
        while(len) {
            currentQueue = queue;
            queue = [];
            while (++queueIndex < len) {
                if (currentQueue) {
                    currentQueue[queueIndex].run();
                }
            }
            queueIndex = -1;
            len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
    }
    function nextTick(fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
            }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
            runTimeout(drainQueue);
        }
    }
    // v8 likes predictible objects
    function Item(fun, array) {
        this.fun = fun;
        this.array = array;
    }
    Item.prototype.run = function () {
        this.fun.apply(null, this.array);
    };
    var title = 'browser';
    var platform = 'browser';
    var browser = true;
    var env = {};
    var argv = [];
    var version = ''; // empty string to avoid regexp issues
    var versions = {};
    var release = {};
    var config = {};

    function noop() {}

    var on = noop;
    var addListener = noop;
    var once = noop;
    var off = noop;
    var removeListener = noop;
    var removeAllListeners = noop;
    var emit = noop;

    function binding(name) {
        throw new Error('process.binding is not supported');
    }

    function cwd () { return '/' }
    function chdir (dir) {
        throw new Error('process.chdir is not supported');
    }function umask() { return 0; }

    // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
    var performance = global$1.performance || {};
    var performanceNow =
      performance.now        ||
      performance.mozNow     ||
      performance.msNow      ||
      performance.oNow       ||
      performance.webkitNow  ||
      function(){ return (new Date()).getTime() };

    // generate timestamp or delta
    // see http://nodejs.org/api/process.html#process_process_hrtime
    function hrtime(previousTimestamp){
      var clocktime = performanceNow.call(performance)*1e-3;
      var seconds = Math.floor(clocktime);
      var nanoseconds = Math.floor((clocktime%1)*1e9);
      if (previousTimestamp) {
        seconds = seconds - previousTimestamp[0];
        nanoseconds = nanoseconds - previousTimestamp[1];
        if (nanoseconds<0) {
          seconds--;
          nanoseconds += 1e9;
        }
      }
      return [seconds,nanoseconds]
    }

    var startTime = new Date();
    function uptime() {
      var currentTime = new Date();
      var dif = currentTime - startTime;
      return dif / 1000;
    }

    var process = {
      nextTick: nextTick,
      title: title,
      browser: browser,
      env: env,
      argv: argv,
      version: version,
      versions: versions,
      on: on,
      addListener: addListener,
      once: once,
      off: off,
      removeListener: removeListener,
      removeAllListeners: removeAllListeners,
      emit: emit,
      binding: binding,
      cwd: cwd,
      chdir: chdir,
      umask: umask,
      hrtime: hrtime,
      platform: platform,
      release: release,
      config: config,
      uptime: uptime
    };

    var inherits;
    if (typeof Object.create === 'function'){
      inherits = function inherits(ctor, superCtor) {
        // implementation from standard node.js 'util' module
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      };
    } else {
      inherits = function inherits(ctor, superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function () {};
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      };
    }
    var inherits$1 = inherits;

    var formatRegExp = /%[sdj%]/g;
    function format(f) {
      if (!isString(f)) {
        var objects = [];
        for (var i = 0; i < arguments.length; i++) {
          objects.push(inspect(arguments[i]));
        }
        return objects.join(' ');
      }

      var i = 1;
      var args = arguments;
      var len = args.length;
      var str = String(f).replace(formatRegExp, function(x) {
        if (x === '%%') return '%';
        if (i >= len) return x;
        switch (x) {
          case '%s': return String(args[i++]);
          case '%d': return Number(args[i++]);
          case '%j':
            try {
              return JSON.stringify(args[i++]);
            } catch (_) {
              return '[Circular]';
            }
          default:
            return x;
        }
      });
      for (var x = args[i]; i < len; x = args[++i]) {
        if (isNull(x) || !isObject(x)) {
          str += ' ' + x;
        } else {
          str += ' ' + inspect(x);
        }
      }
      return str;
    }

    // Mark that a method should not be used.
    // Returns a modified function which warns once by default.
    // If --no-deprecation is set, then it is a no-op.
    function deprecate(fn, msg) {
      // Allow for deprecating things in the process of starting up.
      if (isUndefined(global$1.process)) {
        return function() {
          return deprecate(fn, msg).apply(this, arguments);
        };
      }

      var warned = false;
      function deprecated() {
        if (!warned) {
          {
            console.error(msg);
          }
          warned = true;
        }
        return fn.apply(this, arguments);
      }

      return deprecated;
    }

    var debugs = {};
    var debugEnviron;
    function debuglog(set) {
      if (isUndefined(debugEnviron))
        debugEnviron =  '';
      set = set.toUpperCase();
      if (!debugs[set]) {
        if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
          var pid = 0;
          debugs[set] = function() {
            var msg = format.apply(null, arguments);
            console.error('%s %d: %s', set, pid, msg);
          };
        } else {
          debugs[set] = function() {};
        }
      }
      return debugs[set];
    }

    /**
     * Echos the value of a value. Trys to print the value out
     * in the best way possible given the different types.
     *
     * @param {Object} obj The object to print out.
     * @param {Object} opts Optional options object that alters the output.
     */
    /* legacy: obj, showHidden, depth, colors*/
    function inspect(obj, opts) {
      // default options
      var ctx = {
        seen: [],
        stylize: stylizeNoColor
      };
      // legacy...
      if (arguments.length >= 3) ctx.depth = arguments[2];
      if (arguments.length >= 4) ctx.colors = arguments[3];
      if (isBoolean(opts)) {
        // legacy...
        ctx.showHidden = opts;
      } else if (opts) {
        // got an "options" object
        _extend(ctx, opts);
      }
      // set default options
      if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
      if (isUndefined(ctx.depth)) ctx.depth = 2;
      if (isUndefined(ctx.colors)) ctx.colors = false;
      if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
      if (ctx.colors) ctx.stylize = stylizeWithColor;
      return formatValue(ctx, obj, ctx.depth);
    }

    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    inspect.colors = {
      'bold' : [1, 22],
      'italic' : [3, 23],
      'underline' : [4, 24],
      'inverse' : [7, 27],
      'white' : [37, 39],
      'grey' : [90, 39],
      'black' : [30, 39],
      'blue' : [34, 39],
      'cyan' : [36, 39],
      'green' : [32, 39],
      'magenta' : [35, 39],
      'red' : [31, 39],
      'yellow' : [33, 39]
    };

    // Don't use 'blue' not visible on cmd.exe
    inspect.styles = {
      'special': 'cyan',
      'number': 'yellow',
      'boolean': 'yellow',
      'undefined': 'grey',
      'null': 'bold',
      'string': 'green',
      'date': 'magenta',
      // "name": intentionally not styling
      'regexp': 'red'
    };


    function stylizeWithColor(str, styleType) {
      var style = inspect.styles[styleType];

      if (style) {
        return '\u001b[' + inspect.colors[style][0] + 'm' + str +
               '\u001b[' + inspect.colors[style][1] + 'm';
      } else {
        return str;
      }
    }


    function stylizeNoColor(str, styleType) {
      return str;
    }


    function arrayToHash(array) {
      var hash = {};

      array.forEach(function(val, idx) {
        hash[val] = true;
      });

      return hash;
    }


    function formatValue(ctx, value, recurseTimes) {
      // Provide a hook for user-specified inspect functions.
      // Check that value is an object with an inspect function on it
      if (ctx.customInspect &&
          value &&
          isFunction(value.inspect) &&
          // Filter out the util module, it's inspect function is special
          value.inspect !== inspect &&
          // Also filter out any prototype objects using the circular check.
          !(value.constructor && value.constructor.prototype === value)) {
        var ret = value.inspect(recurseTimes, ctx);
        if (!isString(ret)) {
          ret = formatValue(ctx, ret, recurseTimes);
        }
        return ret;
      }

      // Primitive types cannot have properties
      var primitive = formatPrimitive(ctx, value);
      if (primitive) {
        return primitive;
      }

      // Look up the keys of the object.
      var keys = Object.keys(value);
      var visibleKeys = arrayToHash(keys);

      if (ctx.showHidden) {
        keys = Object.getOwnPropertyNames(value);
      }

      // IE doesn't make error fields non-enumerable
      // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
      if (isError(value)
          && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
        return formatError(value);
      }

      // Some type of object without properties can be shortcutted.
      if (keys.length === 0) {
        if (isFunction(value)) {
          var name = value.name ? ': ' + value.name : '';
          return ctx.stylize('[Function' + name + ']', 'special');
        }
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        }
        if (isDate(value)) {
          return ctx.stylize(Date.prototype.toString.call(value), 'date');
        }
        if (isError(value)) {
          return formatError(value);
        }
      }

      var base = '', array = false, braces = ['{', '}'];

      // Make Array say that they are Array
      if (isArray$1(value)) {
        array = true;
        braces = ['[', ']'];
      }

      // Make functions say that they are functions
      if (isFunction(value)) {
        var n = value.name ? ': ' + value.name : '';
        base = ' [Function' + n + ']';
      }

      // Make RegExps say that they are RegExps
      if (isRegExp(value)) {
        base = ' ' + RegExp.prototype.toString.call(value);
      }

      // Make dates with properties first say the date
      if (isDate(value)) {
        base = ' ' + Date.prototype.toUTCString.call(value);
      }

      // Make error with message first say the error
      if (isError(value)) {
        base = ' ' + formatError(value);
      }

      if (keys.length === 0 && (!array || value.length == 0)) {
        return braces[0] + base + braces[1];
      }

      if (recurseTimes < 0) {
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        } else {
          return ctx.stylize('[Object]', 'special');
        }
      }

      ctx.seen.push(value);

      var output;
      if (array) {
        output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
      } else {
        output = keys.map(function(key) {
          return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
        });
      }

      ctx.seen.pop();

      return reduceToSingleString(output, base, braces);
    }


    function formatPrimitive(ctx, value) {
      if (isUndefined(value))
        return ctx.stylize('undefined', 'undefined');
      if (isString(value)) {
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return ctx.stylize(simple, 'string');
      }
      if (isNumber(value))
        return ctx.stylize('' + value, 'number');
      if (isBoolean(value))
        return ctx.stylize('' + value, 'boolean');
      // For some reason typeof null is "object", so special case here.
      if (isNull(value))
        return ctx.stylize('null', 'null');
    }


    function formatError(value) {
      return '[' + Error.prototype.toString.call(value) + ']';
    }


    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
      var output = [];
      for (var i = 0, l = value.length; i < l; ++i) {
        if (hasOwnProperty(value, String(i))) {
          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
              String(i), true));
        } else {
          output.push('');
        }
      }
      keys.forEach(function(key) {
        if (!key.match(/^\d+$/)) {
          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
              key, true));
        }
      });
      return output;
    }


    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
      var name, str, desc;
      desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
      if (desc.get) {
        if (desc.set) {
          str = ctx.stylize('[Getter/Setter]', 'special');
        } else {
          str = ctx.stylize('[Getter]', 'special');
        }
      } else {
        if (desc.set) {
          str = ctx.stylize('[Setter]', 'special');
        }
      }
      if (!hasOwnProperty(visibleKeys, key)) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
          if (isNull(recurseTimes)) {
            str = formatValue(ctx, desc.value, null);
          } else {
            str = formatValue(ctx, desc.value, recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (array) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = ctx.stylize('[Circular]', 'special');
        }
      }
      if (isUndefined(name)) {
        if (array && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = ctx.stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = ctx.stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    }


    function reduceToSingleString(output, base, braces) {
      var length = output.reduce(function(prev, cur) {
        if (cur.indexOf('\n') >= 0) ;
        return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
      }, 0);

      if (length > 60) {
        return braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];
      }

      return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }


    // NOTE: These type checking functions intentionally don't use `instanceof`
    // because it is fragile and can be easily faked with `Object.create()`.
    function isArray$1(ar) {
      return Array.isArray(ar);
    }

    function isBoolean(arg) {
      return typeof arg === 'boolean';
    }

    function isNull(arg) {
      return arg === null;
    }

    function isNullOrUndefined(arg) {
      return arg == null;
    }

    function isNumber(arg) {
      return typeof arg === 'number';
    }

    function isString(arg) {
      return typeof arg === 'string';
    }

    function isSymbol(arg) {
      return typeof arg === 'symbol';
    }

    function isUndefined(arg) {
      return arg === void 0;
    }

    function isRegExp(re) {
      return isObject(re) && objectToString(re) === '[object RegExp]';
    }

    function isObject(arg) {
      return typeof arg === 'object' && arg !== null;
    }

    function isDate(d) {
      return isObject(d) && objectToString(d) === '[object Date]';
    }

    function isError(e) {
      return isObject(e) &&
          (objectToString(e) === '[object Error]' || e instanceof Error);
    }

    function isFunction(arg) {
      return typeof arg === 'function';
    }

    function isPrimitive(arg) {
      return arg === null ||
             typeof arg === 'boolean' ||
             typeof arg === 'number' ||
             typeof arg === 'string' ||
             typeof arg === 'symbol' ||  // ES6 symbol
             typeof arg === 'undefined';
    }

    function isBuffer$1(maybeBuf) {
      return isBuffer(maybeBuf);
    }

    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }


    function pad(n) {
      return n < 10 ? '0' + n.toString(10) : n.toString(10);
    }


    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                  'Oct', 'Nov', 'Dec'];

    // 26 Feb 16:19:34
    function timestamp() {
      var d = new Date();
      var time = [pad(d.getHours()),
                  pad(d.getMinutes()),
                  pad(d.getSeconds())].join(':');
      return [d.getDate(), months[d.getMonth()], time].join(' ');
    }


    // log is just a thin wrapper to console.log that prepends a timestamp
    function log() {
      console.log('%s - %s', timestamp(), format.apply(null, arguments));
    }

    function _extend(origin, add) {
      // Don't do anything if add isn't an object
      if (!add || !isObject(add)) return origin;

      var keys = Object.keys(add);
      var i = keys.length;
      while (i--) {
        origin[keys[i]] = add[keys[i]];
      }
      return origin;
    }
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    var util = {
      inherits: inherits$1,
      _extend: _extend,
      log: log,
      isBuffer: isBuffer$1,
      isPrimitive: isPrimitive,
      isFunction: isFunction,
      isError: isError,
      isDate: isDate,
      isObject: isObject,
      isRegExp: isRegExp,
      isUndefined: isUndefined,
      isSymbol: isSymbol,
      isString: isString,
      isNumber: isNumber,
      isNullOrUndefined: isNullOrUndefined,
      isNull: isNull,
      isBoolean: isBoolean,
      isArray: isArray$1,
      inspect: inspect,
      deprecate: deprecate,
      format: format,
      debuglog: debuglog
    };

    var util$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        format: format,
        deprecate: deprecate,
        debuglog: debuglog,
        inspect: inspect,
        isArray: isArray$1,
        isBoolean: isBoolean,
        isNull: isNull,
        isNullOrUndefined: isNullOrUndefined,
        isNumber: isNumber,
        isString: isString,
        isSymbol: isSymbol,
        isUndefined: isUndefined,
        isRegExp: isRegExp,
        isObject: isObject,
        isDate: isDate,
        isError: isError,
        isFunction: isFunction,
        isPrimitive: isPrimitive,
        isBuffer: isBuffer$1,
        log: log,
        inherits: inherits$1,
        _extend: _extend,
        'default': util
    });

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function getAugmentedNamespace(n) {
    	if (n.__esModule) return n;
    	var a = Object.defineProperty({}, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var utils = createCommonjsModule(function (module, exports) {

    exports.isInteger = num => {
      if (typeof num === 'number') {
        return Number.isInteger(num);
      }
      if (typeof num === 'string' && num.trim() !== '') {
        return Number.isInteger(Number(num));
      }
      return false;
    };

    /**
     * Find a node of the given type
     */

    exports.find = (node, type) => node.nodes.find(node => node.type === type);

    /**
     * Find a node of the given type
     */

    exports.exceedsLimit = (min, max, step = 1, limit) => {
      if (limit === false) return false;
      if (!exports.isInteger(min) || !exports.isInteger(max)) return false;
      return ((Number(max) - Number(min)) / Number(step)) >= limit;
    };

    /**
     * Escape the given node with '\\' before node.value
     */

    exports.escapeNode = (block, n = 0, type) => {
      let node = block.nodes[n];
      if (!node) return;

      if ((type && node.type === type) || node.type === 'open' || node.type === 'close') {
        if (node.escaped !== true) {
          node.value = '\\' + node.value;
          node.escaped = true;
        }
      }
    };

    /**
     * Returns true if the given brace node should be enclosed in literal braces
     */

    exports.encloseBrace = node => {
      if (node.type !== 'brace') return false;
      if ((node.commas >> 0 + node.ranges >> 0) === 0) {
        node.invalid = true;
        return true;
      }
      return false;
    };

    /**
     * Returns true if a brace node is invalid.
     */

    exports.isInvalidBrace = block => {
      if (block.type !== 'brace') return false;
      if (block.invalid === true || block.dollar) return true;
      if ((block.commas >> 0 + block.ranges >> 0) === 0) {
        block.invalid = true;
        return true;
      }
      if (block.open !== true || block.close !== true) {
        block.invalid = true;
        return true;
      }
      return false;
    };

    /**
     * Returns true if a node is an open or close node
     */

    exports.isOpenOrClose = node => {
      if (node.type === 'open' || node.type === 'close') {
        return true;
      }
      return node.open === true || node.close === true;
    };

    /**
     * Reduce an array of text nodes.
     */

    exports.reduce = nodes => nodes.reduce((acc, node) => {
      if (node.type === 'text') acc.push(node.value);
      if (node.type === 'range') node.type = 'text';
      return acc;
    }, []);

    /**
     * Flatten an array
     */

    exports.flatten = (...args) => {
      const result = [];
      const flat = arr => {
        for (let i = 0; i < arr.length; i++) {
          let ele = arr[i];
          Array.isArray(ele) ? flat(ele) : ele !== void 0 && result.push(ele);
        }
        return result;
      };
      flat(args);
      return result;
    };
    });

    var stringify = (ast, options = {}) => {
      let stringify = (node, parent = {}) => {
        let invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
        let invalidNode = node.invalid === true && options.escapeInvalid === true;
        let output = '';

        if (node.value) {
          if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) {
            return '\\' + node.value;
          }
          return node.value;
        }

        if (node.value) {
          return node.value;
        }

        if (node.nodes) {
          for (let child of node.nodes) {
            output += stringify(child);
          }
        }
        return output;
      };

      return stringify(ast);
    };

    /*!
     * is-number <https://github.com/jonschlinkert/is-number>
     *
     * Copyright (c) 2014-present, Jon Schlinkert.
     * Released under the MIT License.
     */

    var isNumber$1 = function(num) {
      if (typeof num === 'number') {
        return num - num === 0;
      }
      if (typeof num === 'string' && num.trim() !== '') {
        return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
      }
      return false;
    };

    const toRegexRange = (min, max, options) => {
      if (isNumber$1(min) === false) {
        throw new TypeError('toRegexRange: expected the first argument to be a number');
      }

      if (max === void 0 || min === max) {
        return String(min);
      }

      if (isNumber$1(max) === false) {
        throw new TypeError('toRegexRange: expected the second argument to be a number.');
      }

      let opts = { relaxZeros: true, ...options };
      if (typeof opts.strictZeros === 'boolean') {
        opts.relaxZeros = opts.strictZeros === false;
      }

      let relax = String(opts.relaxZeros);
      let shorthand = String(opts.shorthand);
      let capture = String(opts.capture);
      let wrap = String(opts.wrap);
      let cacheKey = min + ':' + max + '=' + relax + shorthand + capture + wrap;

      if (toRegexRange.cache.hasOwnProperty(cacheKey)) {
        return toRegexRange.cache[cacheKey].result;
      }

      let a = Math.min(min, max);
      let b = Math.max(min, max);

      if (Math.abs(a - b) === 1) {
        let result = min + '|' + max;
        if (opts.capture) {
          return `(${result})`;
        }
        if (opts.wrap === false) {
          return result;
        }
        return `(?:${result})`;
      }

      let isPadded = hasPadding(min) || hasPadding(max);
      let state = { min, max, a, b };
      let positives = [];
      let negatives = [];

      if (isPadded) {
        state.isPadded = isPadded;
        state.maxLen = String(state.max).length;
      }

      if (a < 0) {
        let newMin = b < 0 ? Math.abs(b) : 1;
        negatives = splitToPatterns(newMin, Math.abs(a), state, opts);
        a = state.a = 0;
      }

      if (b >= 0) {
        positives = splitToPatterns(a, b, state, opts);
      }

      state.negatives = negatives;
      state.positives = positives;
      state.result = collatePatterns(negatives, positives);

      if (opts.capture === true) {
        state.result = `(${state.result})`;
      } else if (opts.wrap !== false && (positives.length + negatives.length) > 1) {
        state.result = `(?:${state.result})`;
      }

      toRegexRange.cache[cacheKey] = state;
      return state.result;
    };

    function collatePatterns(neg, pos, options) {
      let onlyNegative = filterPatterns(neg, pos, '-', false) || [];
      let onlyPositive = filterPatterns(pos, neg, '', false) || [];
      let intersected = filterPatterns(neg, pos, '-?', true) || [];
      let subpatterns = onlyNegative.concat(intersected).concat(onlyPositive);
      return subpatterns.join('|');
    }

    function splitToRanges(min, max) {
      let nines = 1;
      let zeros = 1;

      let stop = countNines(min, nines);
      let stops = new Set([max]);

      while (min <= stop && stop <= max) {
        stops.add(stop);
        nines += 1;
        stop = countNines(min, nines);
      }

      stop = countZeros(max + 1, zeros) - 1;

      while (min < stop && stop <= max) {
        stops.add(stop);
        zeros += 1;
        stop = countZeros(max + 1, zeros) - 1;
      }

      stops = [...stops];
      stops.sort(compare);
      return stops;
    }

    /**
     * Convert a range to a regex pattern
     * @param {Number} `start`
     * @param {Number} `stop`
     * @return {String}
     */

    function rangeToPattern(start, stop, options) {
      if (start === stop) {
        return { pattern: start, count: [], digits: 0 };
      }

      let zipped = zip(start, stop);
      let digits = zipped.length;
      let pattern = '';
      let count = 0;

      for (let i = 0; i < digits; i++) {
        let [startDigit, stopDigit] = zipped[i];

        if (startDigit === stopDigit) {
          pattern += startDigit;

        } else if (startDigit !== '0' || stopDigit !== '9') {
          pattern += toCharacterClass(startDigit, stopDigit);

        } else {
          count++;
        }
      }

      if (count) {
        pattern += options.shorthand === true ? '\\d' : '[0-9]';
      }

      return { pattern, count: [count], digits };
    }

    function splitToPatterns(min, max, tok, options) {
      let ranges = splitToRanges(min, max);
      let tokens = [];
      let start = min;
      let prev;

      for (let i = 0; i < ranges.length; i++) {
        let max = ranges[i];
        let obj = rangeToPattern(String(start), String(max), options);
        let zeros = '';

        if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
          if (prev.count.length > 1) {
            prev.count.pop();
          }

          prev.count.push(obj.count[0]);
          prev.string = prev.pattern + toQuantifier(prev.count);
          start = max + 1;
          continue;
        }

        if (tok.isPadded) {
          zeros = padZeros(max, tok, options);
        }

        obj.string = zeros + obj.pattern + toQuantifier(obj.count);
        tokens.push(obj);
        start = max + 1;
        prev = obj;
      }

      return tokens;
    }

    function filterPatterns(arr, comparison, prefix, intersection, options) {
      let result = [];

      for (let ele of arr) {
        let { string } = ele;

        // only push if _both_ are negative...
        if (!intersection && !contains(comparison, 'string', string)) {
          result.push(prefix + string);
        }

        // or _both_ are positive
        if (intersection && contains(comparison, 'string', string)) {
          result.push(prefix + string);
        }
      }
      return result;
    }

    /**
     * Zip strings
     */

    function zip(a, b) {
      let arr = [];
      for (let i = 0; i < a.length; i++) arr.push([a[i], b[i]]);
      return arr;
    }

    function compare(a, b) {
      return a > b ? 1 : b > a ? -1 : 0;
    }

    function contains(arr, key, val) {
      return arr.some(ele => ele[key] === val);
    }

    function countNines(min, len) {
      return Number(String(min).slice(0, -len) + '9'.repeat(len));
    }

    function countZeros(integer, zeros) {
      return integer - (integer % Math.pow(10, zeros));
    }

    function toQuantifier(digits) {
      let [start = 0, stop = ''] = digits;
      if (stop || start > 1) {
        return `{${start + (stop ? ',' + stop : '')}}`;
      }
      return '';
    }

    function toCharacterClass(a, b, options) {
      return `[${a}${(b - a === 1) ? '' : '-'}${b}]`;
    }

    function hasPadding(str) {
      return /^-?(0+)\d/.test(str);
    }

    function padZeros(value, tok, options) {
      if (!tok.isPadded) {
        return value;
      }

      let diff = Math.abs(tok.maxLen - String(value).length);
      let relax = options.relaxZeros !== false;

      switch (diff) {
        case 0:
          return '';
        case 1:
          return relax ? '0?' : '0';
        case 2:
          return relax ? '0{0,2}' : '00';
        default: {
          return relax ? `0{0,${diff}}` : `0{${diff}}`;
        }
      }
    }

    /**
     * Cache
     */

    toRegexRange.cache = {};
    toRegexRange.clearCache = () => (toRegexRange.cache = {});

    /**
     * Expose `toRegexRange`
     */

    var toRegexRange_1 = toRegexRange;

    var util$2 = /*@__PURE__*/getAugmentedNamespace(util$1);

    const isObject$1 = val => val !== null && typeof val === 'object' && !Array.isArray(val);

    const transform = toNumber => {
      return value => toNumber === true ? Number(value) : String(value);
    };

    const isValidValue = value => {
      return typeof value === 'number' || (typeof value === 'string' && value !== '');
    };

    const isNumber$2 = num => Number.isInteger(+num);

    const zeros = input => {
      let value = `${input}`;
      let index = -1;
      if (value[0] === '-') value = value.slice(1);
      if (value === '0') return false;
      while (value[++index] === '0');
      return index > 0;
    };

    const stringify$1 = (start, end, options) => {
      if (typeof start === 'string' || typeof end === 'string') {
        return true;
      }
      return options.stringify === true;
    };

    const pad$1 = (input, maxLength, toNumber) => {
      if (maxLength > 0) {
        let dash = input[0] === '-' ? '-' : '';
        if (dash) input = input.slice(1);
        input = (dash + input.padStart(dash ? maxLength - 1 : maxLength, '0'));
      }
      if (toNumber === false) {
        return String(input);
      }
      return input;
    };

    const toMaxLen = (input, maxLength) => {
      let negative = input[0] === '-' ? '-' : '';
      if (negative) {
        input = input.slice(1);
        maxLength--;
      }
      while (input.length < maxLength) input = '0' + input;
      return negative ? ('-' + input) : input;
    };

    const toSequence = (parts, options) => {
      parts.negatives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      parts.positives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

      let prefix = options.capture ? '' : '?:';
      let positives = '';
      let negatives = '';
      let result;

      if (parts.positives.length) {
        positives = parts.positives.join('|');
      }

      if (parts.negatives.length) {
        negatives = `-(${prefix}${parts.negatives.join('|')})`;
      }

      if (positives && negatives) {
        result = `${positives}|${negatives}`;
      } else {
        result = positives || negatives;
      }

      if (options.wrap) {
        return `(${prefix}${result})`;
      }

      return result;
    };

    const toRange = (a, b, isNumbers, options) => {
      if (isNumbers) {
        return toRegexRange_1(a, b, { wrap: false, ...options });
      }

      let start = String.fromCharCode(a);
      if (a === b) return start;

      let stop = String.fromCharCode(b);
      return `[${start}-${stop}]`;
    };

    const toRegex = (start, end, options) => {
      if (Array.isArray(start)) {
        let wrap = options.wrap === true;
        let prefix = options.capture ? '' : '?:';
        return wrap ? `(${prefix}${start.join('|')})` : start.join('|');
      }
      return toRegexRange_1(start, end, options);
    };

    const rangeError = (...args) => {
      return new RangeError('Invalid range arguments: ' + util$2.inspect(...args));
    };

    const invalidRange = (start, end, options) => {
      if (options.strictRanges === true) throw rangeError([start, end]);
      return [];
    };

    const invalidStep = (step, options) => {
      if (options.strictRanges === true) {
        throw new TypeError(`Expected step "${step}" to be a number`);
      }
      return [];
    };

    const fillNumbers = (start, end, step = 1, options = {}) => {
      let a = Number(start);
      let b = Number(end);

      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        if (options.strictRanges === true) throw rangeError([start, end]);
        return [];
      }

      // fix negative zero
      if (a === 0) a = 0;
      if (b === 0) b = 0;

      let descending = a > b;
      let startString = String(start);
      let endString = String(end);
      let stepString = String(step);
      step = Math.max(Math.abs(step), 1);

      let padded = zeros(startString) || zeros(endString) || zeros(stepString);
      let maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
      let toNumber = padded === false && stringify$1(start, end, options) === false;
      let format = options.transform || transform(toNumber);

      if (options.toRegex && step === 1) {
        return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
      }

      let parts = { negatives: [], positives: [] };
      let push = num => parts[num < 0 ? 'negatives' : 'positives'].push(Math.abs(num));
      let range = [];
      let index = 0;

      while (descending ? a >= b : a <= b) {
        if (options.toRegex === true && step > 1) {
          push(a);
        } else {
          range.push(pad$1(format(a, index), maxLen, toNumber));
        }
        a = descending ? a - step : a + step;
        index++;
      }

      if (options.toRegex === true) {
        return step > 1
          ? toSequence(parts, options)
          : toRegex(range, null, { wrap: false, ...options });
      }

      return range;
    };

    const fillLetters = (start, end, step = 1, options = {}) => {
      if ((!isNumber$2(start) && start.length > 1) || (!isNumber$2(end) && end.length > 1)) {
        return invalidRange(start, end, options);
      }


      let format = options.transform || (val => String.fromCharCode(val));
      let a = `${start}`.charCodeAt(0);
      let b = `${end}`.charCodeAt(0);

      let descending = a > b;
      let min = Math.min(a, b);
      let max = Math.max(a, b);

      if (options.toRegex && step === 1) {
        return toRange(min, max, false, options);
      }

      let range = [];
      let index = 0;

      while (descending ? a >= b : a <= b) {
        range.push(format(a, index));
        a = descending ? a - step : a + step;
        index++;
      }

      if (options.toRegex === true) {
        return toRegex(range, null, { wrap: false, options });
      }

      return range;
    };

    const fill = (start, end, step, options = {}) => {
      if (end == null && isValidValue(start)) {
        return [start];
      }

      if (!isValidValue(start) || !isValidValue(end)) {
        return invalidRange(start, end, options);
      }

      if (typeof step === 'function') {
        return fill(start, end, 1, { transform: step });
      }

      if (isObject$1(step)) {
        return fill(start, end, 0, step);
      }

      let opts = { ...options };
      if (opts.capture === true) opts.wrap = true;
      step = step || opts.step || 1;

      if (!isNumber$2(step)) {
        if (step != null && !isObject$1(step)) return invalidStep(step, opts);
        return fill(start, end, 1, step);
      }

      if (isNumber$2(start) && isNumber$2(end)) {
        return fillNumbers(start, end, step, opts);
      }

      return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
    };

    var fillRange = fill;

    const compile = (ast, options = {}) => {
      let walk = (node, parent = {}) => {
        let invalidBlock = utils.isInvalidBrace(parent);
        let invalidNode = node.invalid === true && options.escapeInvalid === true;
        let invalid = invalidBlock === true || invalidNode === true;
        let prefix = options.escapeInvalid === true ? '\\' : '';
        let output = '';

        if (node.isOpen === true) {
          return prefix + node.value;
        }
        if (node.isClose === true) {
          return prefix + node.value;
        }

        if (node.type === 'open') {
          return invalid ? (prefix + node.value) : '(';
        }

        if (node.type === 'close') {
          return invalid ? (prefix + node.value) : ')';
        }

        if (node.type === 'comma') {
          return node.prev.type === 'comma' ? '' : (invalid ? node.value : '|');
        }

        if (node.value) {
          return node.value;
        }

        if (node.nodes && node.ranges > 0) {
          let args = utils.reduce(node.nodes);
          let range = fillRange(...args, { ...options, wrap: false, toRegex: true });

          if (range.length !== 0) {
            return args.length > 1 && range.length > 1 ? `(${range})` : range;
          }
        }

        if (node.nodes) {
          for (let child of node.nodes) {
            output += walk(child, node);
          }
        }
        return output;
      };

      return walk(ast);
    };

    var compile_1 = compile;

    const append = (queue = '', stash = '', enclose = false) => {
      let result = [];

      queue = [].concat(queue);
      stash = [].concat(stash);

      if (!stash.length) return queue;
      if (!queue.length) {
        return enclose ? utils.flatten(stash).map(ele => `{${ele}}`) : stash;
      }

      for (let item of queue) {
        if (Array.isArray(item)) {
          for (let value of item) {
            result.push(append(value, stash, enclose));
          }
        } else {
          for (let ele of stash) {
            if (enclose === true && typeof ele === 'string') ele = `{${ele}}`;
            result.push(Array.isArray(ele) ? append(item, ele, enclose) : (item + ele));
          }
        }
      }
      return utils.flatten(result);
    };

    const expand = (ast, options = {}) => {
      let rangeLimit = options.rangeLimit === void 0 ? 1000 : options.rangeLimit;

      let walk = (node, parent = {}) => {
        node.queue = [];

        let p = parent;
        let q = parent.queue;

        while (p.type !== 'brace' && p.type !== 'root' && p.parent) {
          p = p.parent;
          q = p.queue;
        }

        if (node.invalid || node.dollar) {
          q.push(append(q.pop(), stringify(node, options)));
          return;
        }

        if (node.type === 'brace' && node.invalid !== true && node.nodes.length === 2) {
          q.push(append(q.pop(), ['{}']));
          return;
        }

        if (node.nodes && node.ranges > 0) {
          let args = utils.reduce(node.nodes);

          if (utils.exceedsLimit(...args, options.step, rangeLimit)) {
            throw new RangeError('expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.');
          }

          let range = fillRange(...args, options);
          if (range.length === 0) {
            range = stringify(node, options);
          }

          q.push(append(q.pop(), range));
          node.nodes = [];
          return;
        }

        let enclose = utils.encloseBrace(node);
        let queue = node.queue;
        let block = node;

        while (block.type !== 'brace' && block.type !== 'root' && block.parent) {
          block = block.parent;
          queue = block.queue;
        }

        for (let i = 0; i < node.nodes.length; i++) {
          let child = node.nodes[i];

          if (child.type === 'comma' && node.type === 'brace') {
            if (i === 1) queue.push('');
            queue.push('');
            continue;
          }

          if (child.type === 'close') {
            q.push(append(q.pop(), queue, enclose));
            continue;
          }

          if (child.value && child.type !== 'open') {
            queue.push(append(queue.pop(), child.value));
            continue;
          }

          if (child.nodes) {
            walk(child, node);
          }
        }

        return queue;
      };

      return utils.flatten(walk(ast));
    };

    var expand_1 = expand;

    var constants = {
      MAX_LENGTH: 1024 * 64,

      // Digits
      CHAR_0: '0', /* 0 */
      CHAR_9: '9', /* 9 */

      // Alphabet chars.
      CHAR_UPPERCASE_A: 'A', /* A */
      CHAR_LOWERCASE_A: 'a', /* a */
      CHAR_UPPERCASE_Z: 'Z', /* Z */
      CHAR_LOWERCASE_Z: 'z', /* z */

      CHAR_LEFT_PARENTHESES: '(', /* ( */
      CHAR_RIGHT_PARENTHESES: ')', /* ) */

      CHAR_ASTERISK: '*', /* * */

      // Non-alphabetic chars.
      CHAR_AMPERSAND: '&', /* & */
      CHAR_AT: '@', /* @ */
      CHAR_BACKSLASH: '\\', /* \ */
      CHAR_BACKTICK: '`', /* ` */
      CHAR_CARRIAGE_RETURN: '\r', /* \r */
      CHAR_CIRCUMFLEX_ACCENT: '^', /* ^ */
      CHAR_COLON: ':', /* : */
      CHAR_COMMA: ',', /* , */
      CHAR_DOLLAR: '$', /* . */
      CHAR_DOT: '.', /* . */
      CHAR_DOUBLE_QUOTE: '"', /* " */
      CHAR_EQUAL: '=', /* = */
      CHAR_EXCLAMATION_MARK: '!', /* ! */
      CHAR_FORM_FEED: '\f', /* \f */
      CHAR_FORWARD_SLASH: '/', /* / */
      CHAR_HASH: '#', /* # */
      CHAR_HYPHEN_MINUS: '-', /* - */
      CHAR_LEFT_ANGLE_BRACKET: '<', /* < */
      CHAR_LEFT_CURLY_BRACE: '{', /* { */
      CHAR_LEFT_SQUARE_BRACKET: '[', /* [ */
      CHAR_LINE_FEED: '\n', /* \n */
      CHAR_NO_BREAK_SPACE: '\u00A0', /* \u00A0 */
      CHAR_PERCENT: '%', /* % */
      CHAR_PLUS: '+', /* + */
      CHAR_QUESTION_MARK: '?', /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: '>', /* > */
      CHAR_RIGHT_CURLY_BRACE: '}', /* } */
      CHAR_RIGHT_SQUARE_BRACKET: ']', /* ] */
      CHAR_SEMICOLON: ';', /* ; */
      CHAR_SINGLE_QUOTE: '\'', /* ' */
      CHAR_SPACE: ' ', /*   */
      CHAR_TAB: '\t', /* \t */
      CHAR_UNDERSCORE: '_', /* _ */
      CHAR_VERTICAL_LINE: '|', /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: '\uFEFF' /* \uFEFF */
    };

    /**
     * Constants
     */

    const {
      MAX_LENGTH,
      CHAR_BACKSLASH, /* \ */
      CHAR_BACKTICK, /* ` */
      CHAR_COMMA, /* , */
      CHAR_DOT, /* . */
      CHAR_LEFT_PARENTHESES, /* ( */
      CHAR_RIGHT_PARENTHESES, /* ) */
      CHAR_LEFT_CURLY_BRACE, /* { */
      CHAR_RIGHT_CURLY_BRACE, /* } */
      CHAR_LEFT_SQUARE_BRACKET, /* [ */
      CHAR_RIGHT_SQUARE_BRACKET, /* ] */
      CHAR_DOUBLE_QUOTE, /* " */
      CHAR_SINGLE_QUOTE, /* ' */
      CHAR_NO_BREAK_SPACE,
      CHAR_ZERO_WIDTH_NOBREAK_SPACE
    } = constants;

    /**
     * parse
     */

    const parse = (input, options = {}) => {
      if (typeof input !== 'string') {
        throw new TypeError('Expected a string');
      }

      let opts = options || {};
      let max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      if (input.length > max) {
        throw new SyntaxError(`Input length (${input.length}), exceeds max characters (${max})`);
      }

      let ast = { type: 'root', input, nodes: [] };
      let stack = [ast];
      let block = ast;
      let prev = ast;
      let brackets = 0;
      let length = input.length;
      let index = 0;
      let depth = 0;
      let value;

      /**
       * Helpers
       */

      const advance = () => input[index++];
      const push = node => {
        if (node.type === 'text' && prev.type === 'dot') {
          prev.type = 'text';
        }

        if (prev && prev.type === 'text' && node.type === 'text') {
          prev.value += node.value;
          return;
        }

        block.nodes.push(node);
        node.parent = block;
        node.prev = prev;
        prev = node;
        return node;
      };

      push({ type: 'bos' });

      while (index < length) {
        block = stack[stack.length - 1];
        value = advance();

        /**
         * Invalid chars
         */

        if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) {
          continue;
        }

        /**
         * Escaped chars
         */

        if (value === CHAR_BACKSLASH) {
          push({ type: 'text', value: (options.keepEscaping ? value : '') + advance() });
          continue;
        }

        /**
         * Right square bracket (literal): ']'
         */

        if (value === CHAR_RIGHT_SQUARE_BRACKET) {
          push({ type: 'text', value: '\\' + value });
          continue;
        }

        /**
         * Left square bracket: '['
         */

        if (value === CHAR_LEFT_SQUARE_BRACKET) {
          brackets++;
          let next;

          while (index < length && (next = advance())) {
            value += next;

            if (next === CHAR_LEFT_SQUARE_BRACKET) {
              brackets++;
              continue;
            }

            if (next === CHAR_BACKSLASH) {
              value += advance();
              continue;
            }

            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              brackets--;

              if (brackets === 0) {
                break;
              }
            }
          }

          push({ type: 'text', value });
          continue;
        }

        /**
         * Parentheses
         */

        if (value === CHAR_LEFT_PARENTHESES) {
          block = push({ type: 'paren', nodes: [] });
          stack.push(block);
          push({ type: 'text', value });
          continue;
        }

        if (value === CHAR_RIGHT_PARENTHESES) {
          if (block.type !== 'paren') {
            push({ type: 'text', value });
            continue;
          }
          block = stack.pop();
          push({ type: 'text', value });
          block = stack[stack.length - 1];
          continue;
        }

        /**
         * Quotes: '|"|`
         */

        if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
          let open = value;
          let next;

          if (options.keepQuotes !== true) {
            value = '';
          }

          while (index < length && (next = advance())) {
            if (next === CHAR_BACKSLASH) {
              value += next + advance();
              continue;
            }

            if (next === open) {
              if (options.keepQuotes === true) value += next;
              break;
            }

            value += next;
          }

          push({ type: 'text', value });
          continue;
        }

        /**
         * Left curly brace: '{'
         */

        if (value === CHAR_LEFT_CURLY_BRACE) {
          depth++;

          let dollar = prev.value && prev.value.slice(-1) === '$' || block.dollar === true;
          let brace = {
            type: 'brace',
            open: true,
            close: false,
            dollar,
            depth,
            commas: 0,
            ranges: 0,
            nodes: []
          };

          block = push(brace);
          stack.push(block);
          push({ type: 'open', value });
          continue;
        }

        /**
         * Right curly brace: '}'
         */

        if (value === CHAR_RIGHT_CURLY_BRACE) {
          if (block.type !== 'brace') {
            push({ type: 'text', value });
            continue;
          }

          let type = 'close';
          block = stack.pop();
          block.close = true;

          push({ type, value });
          depth--;

          block = stack[stack.length - 1];
          continue;
        }

        /**
         * Comma: ','
         */

        if (value === CHAR_COMMA && depth > 0) {
          if (block.ranges > 0) {
            block.ranges = 0;
            let open = block.nodes.shift();
            block.nodes = [open, { type: 'text', value: stringify(block) }];
          }

          push({ type: 'comma', value });
          block.commas++;
          continue;
        }

        /**
         * Dot: '.'
         */

        if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
          let siblings = block.nodes;

          if (depth === 0 || siblings.length === 0) {
            push({ type: 'text', value });
            continue;
          }

          if (prev.type === 'dot') {
            block.range = [];
            prev.value += value;
            prev.type = 'range';

            if (block.nodes.length !== 3 && block.nodes.length !== 5) {
              block.invalid = true;
              block.ranges = 0;
              prev.type = 'text';
              continue;
            }

            block.ranges++;
            block.args = [];
            continue;
          }

          if (prev.type === 'range') {
            siblings.pop();

            let before = siblings[siblings.length - 1];
            before.value += prev.value + value;
            prev = before;
            block.ranges--;
            continue;
          }

          push({ type: 'dot', value });
          continue;
        }

        /**
         * Text
         */

        push({ type: 'text', value });
      }

      // Mark imbalanced braces and brackets as invalid
      do {
        block = stack.pop();

        if (block.type !== 'root') {
          block.nodes.forEach(node => {
            if (!node.nodes) {
              if (node.type === 'open') node.isOpen = true;
              if (node.type === 'close') node.isClose = true;
              if (!node.nodes) node.type = 'text';
              node.invalid = true;
            }
          });

          // get the location of the block on parent.nodes (block's siblings)
          let parent = stack[stack.length - 1];
          let index = parent.nodes.indexOf(block);
          // replace the (invalid) block with it's nodes
          parent.nodes.splice(index, 1, ...block.nodes);
        }
      } while (stack.length > 0);

      push({ type: 'eos' });
      return ast;
    };

    var parse_1 = parse;

    /**
     * Expand the given pattern or create a regex-compatible string.
     *
     * ```js
     * const braces = require('braces');
     * console.log(braces('{a,b,c}', { compile: true })); //=> ['(a|b|c)']
     * console.log(braces('{a,b,c}')); //=> ['a', 'b', 'c']
     * ```
     * @param {String} `str`
     * @param {Object} `options`
     * @return {String}
     * @api public
     */

    const braces = (input, options = {}) => {
      let output = [];

      if (Array.isArray(input)) {
        for (let pattern of input) {
          let result = braces.create(pattern, options);
          if (Array.isArray(result)) {
            output.push(...result);
          } else {
            output.push(result);
          }
        }
      } else {
        output = [].concat(braces.create(input, options));
      }

      if (options && options.expand === true && options.nodupes === true) {
        output = [...new Set(output)];
      }
      return output;
    };

    /**
     * Parse the given `str` with the given `options`.
     *
     * ```js
     * // braces.parse(pattern, [, options]);
     * const ast = braces.parse('a/{b,c}/d');
     * console.log(ast);
     * ```
     * @param {String} pattern Brace pattern to parse
     * @param {Object} options
     * @return {Object} Returns an AST
     * @api public
     */

    braces.parse = (input, options = {}) => parse_1(input, options);

    /**
     * Creates a braces string from an AST, or an AST node.
     *
     * ```js
     * const braces = require('braces');
     * let ast = braces.parse('foo/{a,b}/bar');
     * console.log(stringify(ast.nodes[2])); //=> '{a,b}'
     * ```
     * @param {String} `input` Brace pattern or AST.
     * @param {Object} `options`
     * @return {Array} Returns an array of expanded values.
     * @api public
     */

    braces.stringify = (input, options = {}) => {
      if (typeof input === 'string') {
        return stringify(braces.parse(input, options), options);
      }
      return stringify(input, options);
    };

    /**
     * Compiles a brace pattern into a regex-compatible, optimized string.
     * This method is called by the main [braces](#braces) function by default.
     *
     * ```js
     * const braces = require('braces');
     * console.log(braces.compile('a/{b,c}/d'));
     * //=> ['a/(b|c)/d']
     * ```
     * @param {String} `input` Brace pattern or AST.
     * @param {Object} `options`
     * @return {Array} Returns an array of expanded values.
     * @api public
     */

    braces.compile = (input, options = {}) => {
      if (typeof input === 'string') {
        input = braces.parse(input, options);
      }
      return compile_1(input, options);
    };

    /**
     * Expands a brace pattern into an array. This method is called by the
     * main [braces](#braces) function when `options.expand` is true. Before
     * using this method it's recommended that you read the [performance notes](#performance))
     * and advantages of using [.compile](#compile) instead.
     *
     * ```js
     * const braces = require('braces');
     * console.log(braces.expand('a/{b,c}/d'));
     * //=> ['a/b/d', 'a/c/d'];
     * ```
     * @param {String} `pattern` Brace pattern
     * @param {Object} `options`
     * @return {Array} Returns an array of expanded values.
     * @api public
     */

    braces.expand = (input, options = {}) => {
      if (typeof input === 'string') {
        input = braces.parse(input, options);
      }

      let result = expand_1(input, options);

      // filter out empty strings if specified
      if (options.noempty === true) {
        result = result.filter(Boolean);
      }

      // filter out duplicates if specified
      if (options.nodupes === true) {
        result = [...new Set(result)];
      }

      return result;
    };

    /**
     * Processes a brace pattern and returns either an expanded array
     * (if `options.expand` is true), a highly optimized regex-compatible string.
     * This method is called by the main [braces](#braces) function.
     *
     * ```js
     * const braces = require('braces');
     * console.log(braces.create('user-{200..300}/project-{a,b,c}-{1..10}'))
     * //=> 'user-(20[0-9]|2[1-9][0-9]|300)/project-(a|b|c)-([1-9]|10)'
     * ```
     * @param {String} `pattern` Brace pattern
     * @param {Object} `options`
     * @return {Array} Returns an array of expanded values.
     * @api public
     */

    braces.create = (input, options = {}) => {
      if (input === '' || input.length < 3) {
        return [input];
      }

     return options.expand !== true
        ? braces.compile(input, options)
        : braces.expand(input, options);
    };

    /**
     * Expose "braces"
     */

    var braces_1 = braces;

    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.

    // resolves . and .. elements in a path array with directory names there
    // must be no slashes, empty elements, or device names (c:\) in the array
    // (so also no leading and trailing slashes - it does not distinguish
    // relative and absolute paths)
    function normalizeArray(parts, allowAboveRoot) {
      // if the path tries to go above the root, `up` ends up > 0
      var up = 0;
      for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === '.') {
          parts.splice(i, 1);
        } else if (last === '..') {
          parts.splice(i, 1);
          up++;
        } else if (up) {
          parts.splice(i, 1);
          up--;
        }
      }

      // if the path is allowed to go above the root, restore leading ..s
      if (allowAboveRoot) {
        for (; up--; up) {
          parts.unshift('..');
        }
      }

      return parts;
    }

    // Split a filename into [root, dir, basename, ext], unix version
    // 'root' is just a slash, or nothing.
    var splitPathRe =
        /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    var splitPath = function(filename) {
      return splitPathRe.exec(filename).slice(1);
    };

    // path.resolve([from ...], to)
    // posix version
    function resolve() {
      var resolvedPath = '',
          resolvedAbsolute = false;

      for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = (i >= 0) ? arguments[i] : '/';

        // Skip empty and invalid entries
        if (typeof path !== 'string') {
          throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
          continue;
        }

        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = path.charAt(0) === '/';
      }

      // At this point the path should be resolved to a full absolute path, but
      // handle relative paths to be safe (might happen when process.cwd() fails)

      // Normalize the path
      resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
        return !!p;
      }), !resolvedAbsolute).join('/');

      return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
    }
    // path.normalize(path)
    // posix version
    function normalize(path) {
      var isPathAbsolute = isAbsolute(path),
          trailingSlash = substr(path, -1) === '/';

      // Normalize the path
      path = normalizeArray(filter(path.split('/'), function(p) {
        return !!p;
      }), !isPathAbsolute).join('/');

      if (!path && !isPathAbsolute) {
        path = '.';
      }
      if (path && trailingSlash) {
        path += '/';
      }

      return (isPathAbsolute ? '/' : '') + path;
    }
    // posix version
    function isAbsolute(path) {
      return path.charAt(0) === '/';
    }

    // posix version
    function join() {
      var paths = Array.prototype.slice.call(arguments, 0);
      return normalize(filter(paths, function(p, index) {
        if (typeof p !== 'string') {
          throw new TypeError('Arguments to path.join must be strings');
        }
        return p;
      }).join('/'));
    }


    // path.relative(from, to)
    // posix version
    function relative(from, to) {
      from = resolve(from).substr(1);
      to = resolve(to).substr(1);

      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== '') break;
        }

        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== '') break;
        }

        if (start > end) return [];
        return arr.slice(start, end - start + 1);
      }

      var fromParts = trim(from.split('/'));
      var toParts = trim(to.split('/'));

      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      }

      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
      }

      outputParts = outputParts.concat(toParts.slice(samePartsLength));

      return outputParts.join('/');
    }

    var sep = '/';
    var delimiter = ':';

    function dirname(path) {
      var result = splitPath(path),
          root = result[0],
          dir = result[1];

      if (!root && !dir) {
        // No dirname whatsoever
        return '.';
      }

      if (dir) {
        // It has a dirname, strip trailing slash
        dir = dir.substr(0, dir.length - 1);
      }

      return root + dir;
    }

    function basename(path, ext) {
      var f = splitPath(path)[2];
      // TODO: make this comparison case-insensitive on windows?
      if (ext && f.substr(-1 * ext.length) === ext) {
        f = f.substr(0, f.length - ext.length);
      }
      return f;
    }


    function extname(path) {
      return splitPath(path)[3];
    }
    var path = {
      extname: extname,
      basename: basename,
      dirname: dirname,
      sep: sep,
      delimiter: delimiter,
      relative: relative,
      join: join,
      isAbsolute: isAbsolute,
      normalize: normalize,
      resolve: resolve
    };
    function filter (xs, f) {
        if (xs.filter) return xs.filter(f);
        var res = [];
        for (var i = 0; i < xs.length; i++) {
            if (f(xs[i], i, xs)) res.push(xs[i]);
        }
        return res;
    }

    // String.prototype.substr - negative index don't work in IE8
    var substr = 'ab'.substr(-1) === 'b' ?
        function (str, start, len) { return str.substr(start, len) } :
        function (str, start, len) {
            if (start < 0) start = str.length + start;
            return str.substr(start, len);
        }
    ;

    var path$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        resolve: resolve,
        normalize: normalize,
        isAbsolute: isAbsolute,
        join: join,
        relative: relative,
        sep: sep,
        delimiter: delimiter,
        dirname: dirname,
        basename: basename,
        extname: extname,
        'default': path
    });

    var path$2 = /*@__PURE__*/getAugmentedNamespace(path$1);

    const WIN_SLASH = '\\\\/';
    const WIN_NO_SLASH = `[^${WIN_SLASH}]`;

    /**
     * Posix glob regex
     */

    const DOT_LITERAL = '\\.';
    const PLUS_LITERAL = '\\+';
    const QMARK_LITERAL = '\\?';
    const SLASH_LITERAL = '\\/';
    const ONE_CHAR = '(?=.)';
    const QMARK = '[^/]';
    const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    const NO_DOT = `(?!${DOT_LITERAL})`;
    const NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    const NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    const NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    const QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    const STAR = `${QMARK}*?`;

    const POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR
    };

    /**
     * Windows glob regex
     */

    const WINDOWS_CHARS = {
      ...POSIX_CHARS,

      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`
    };

    /**
     * POSIX Bracket Regex
     */

    const POSIX_REGEX_SOURCE = {
      alnum: 'a-zA-Z0-9',
      alpha: 'a-zA-Z',
      ascii: '\\x00-\\x7F',
      blank: ' \\t',
      cntrl: '\\x00-\\x1F\\x7F',
      digit: '0-9',
      graph: '\\x21-\\x7E',
      lower: 'a-z',
      print: '\\x20-\\x7E ',
      punct: '\\-!"#$%&\'()\\*+,./:;<=>?@[\\]^_`{|}~',
      space: ' \\t\\r\\n\\v\\f',
      upper: 'A-Z',
      word: 'A-Za-z0-9_',
      xdigit: 'A-Fa-f0-9'
    };

    var constants$1 = {
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,

      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,

      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        '***': '*',
        '**/**': '**',
        '**/**/**': '**'
      },

      // Digits
      CHAR_0: 48, /* 0 */
      CHAR_9: 57, /* 9 */

      // Alphabet chars.
      CHAR_UPPERCASE_A: 65, /* A */
      CHAR_LOWERCASE_A: 97, /* a */
      CHAR_UPPERCASE_Z: 90, /* Z */
      CHAR_LOWERCASE_Z: 122, /* z */

      CHAR_LEFT_PARENTHESES: 40, /* ( */
      CHAR_RIGHT_PARENTHESES: 41, /* ) */

      CHAR_ASTERISK: 42, /* * */

      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38, /* & */
      CHAR_AT: 64, /* @ */
      CHAR_BACKWARD_SLASH: 92, /* \ */
      CHAR_CARRIAGE_RETURN: 13, /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94, /* ^ */
      CHAR_COLON: 58, /* : */
      CHAR_COMMA: 44, /* , */
      CHAR_DOT: 46, /* . */
      CHAR_DOUBLE_QUOTE: 34, /* " */
      CHAR_EQUAL: 61, /* = */
      CHAR_EXCLAMATION_MARK: 33, /* ! */
      CHAR_FORM_FEED: 12, /* \f */
      CHAR_FORWARD_SLASH: 47, /* / */
      CHAR_GRAVE_ACCENT: 96, /* ` */
      CHAR_HASH: 35, /* # */
      CHAR_HYPHEN_MINUS: 45, /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60, /* < */
      CHAR_LEFT_CURLY_BRACE: 123, /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91, /* [ */
      CHAR_LINE_FEED: 10, /* \n */
      CHAR_NO_BREAK_SPACE: 160, /* \u00A0 */
      CHAR_PERCENT: 37, /* % */
      CHAR_PLUS: 43, /* + */
      CHAR_QUESTION_MARK: 63, /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62, /* > */
      CHAR_RIGHT_CURLY_BRACE: 125, /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93, /* ] */
      CHAR_SEMICOLON: 59, /* ; */
      CHAR_SINGLE_QUOTE: 39, /* ' */
      CHAR_SPACE: 32, /*   */
      CHAR_TAB: 9, /* \t */
      CHAR_UNDERSCORE: 95, /* _ */
      CHAR_VERTICAL_LINE: 124, /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279, /* \uFEFF */

      SEP: path$2.sep,

      /**
       * Create EXTGLOB_CHARS
       */

      extglobChars(chars) {
        return {
          '!': { type: 'negate', open: '(?:(?!(?:', close: `))${chars.STAR})` },
          '?': { type: 'qmark', open: '(?:', close: ')?' },
          '+': { type: 'plus', open: '(?:', close: ')+' },
          '*': { type: 'star', open: '(?:', close: ')*' },
          '@': { type: 'at', open: '(?:', close: ')' }
        };
      },

      /**
       * Create GLOB_CHARS
       */

      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };

    var utils$1 = createCommonjsModule(function (module, exports) {
    const {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = constants$1;

    exports.isObject = val => val !== null && typeof val === 'object' && !Array.isArray(val);
    exports.hasRegexChars = str => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = str => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = str => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, '\\$1');
    exports.toPosixSlashes = str => str.replace(REGEX_BACKSLASH, '/');

    exports.removeBackslashes = str => {
      return str.replace(REGEX_REMOVE_BACKSLASH, match => {
        return match === '\\' ? '' : match;
      });
    };

    exports.supportsLookbehinds = () => {
      const segs = process.version.slice(1).split('.').map(Number);
      if (segs.length === 3 && segs[0] >= 9 || (segs[0] === 8 && segs[1] >= 10)) {
        return true;
      }
      return false;
    };

    exports.isWindows = options => {
      if (options && typeof options.windows === 'boolean') {
        return options.windows;
      }
      return  path$2.sep === '\\';
    };

    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === '\\') return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };

    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith('./')) {
        output = output.slice(2);
        state.prefix = './';
      }
      return output;
    };

    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? '' : '^';
      const append = options.contains ? '' : '$';

      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    });

    const {
      CHAR_ASTERISK,             /* * */
      CHAR_AT,                   /* @ */
      CHAR_BACKWARD_SLASH,       /* \ */
      CHAR_COMMA: CHAR_COMMA$1,                /* , */
      CHAR_DOT: CHAR_DOT$1,                  /* . */
      CHAR_EXCLAMATION_MARK,     /* ! */
      CHAR_FORWARD_SLASH,        /* / */
      CHAR_LEFT_CURLY_BRACE: CHAR_LEFT_CURLY_BRACE$1,     /* { */
      CHAR_LEFT_PARENTHESES: CHAR_LEFT_PARENTHESES$1,     /* ( */
      CHAR_LEFT_SQUARE_BRACKET: CHAR_LEFT_SQUARE_BRACKET$1,  /* [ */
      CHAR_PLUS,                 /* + */
      CHAR_QUESTION_MARK,        /* ? */
      CHAR_RIGHT_CURLY_BRACE: CHAR_RIGHT_CURLY_BRACE$1,    /* } */
      CHAR_RIGHT_PARENTHESES: CHAR_RIGHT_PARENTHESES$1,    /* ) */
      CHAR_RIGHT_SQUARE_BRACKET: CHAR_RIGHT_SQUARE_BRACKET$1  /* ] */
    } = constants$1;

    const isPathSeparator = code => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };

    const depth = token => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };

    /**
     * Quickly scans a glob pattern and returns an object with a handful of
     * useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
     * `glob` (the actual pattern), and `negated` (true if the path starts with `!`).
     *
     * ```js
     * const pm = require('picomatch');
     * console.log(pm.scan('foo/bar/*.js'));
     * { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
     * ```
     * @param {String} `str`
     * @param {Object} `options`
     * @return {Object} Returns an object with tokens and regex source string.
     * @api public
     */

    const scan = (input, options) => {
      const opts = options || {};

      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];

      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: '', depth: 0, isGlob: false };

      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };

      while (index < length) {
        code = advance();
        let next;

        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();

          if (code === CHAR_LEFT_CURLY_BRACE$1) {
            braceEscaped = true;
          }
          continue;
        }

        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE$1) {
          braces++;

          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }

            if (code === CHAR_LEFT_CURLY_BRACE$1) {
              braces++;
              continue;
            }

            if (braceEscaped !== true && code === CHAR_DOT$1 && (code = advance()) === CHAR_DOT$1) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;

              if (scanToEnd === true) {
                continue;
              }

              break;
            }

            if (braceEscaped !== true && code === CHAR_COMMA$1) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;

              if (scanToEnd === true) {
                continue;
              }

              break;
            }

            if (code === CHAR_RIGHT_CURLY_BRACE$1) {
              braces--;

              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }

          if (scanToEnd === true) {
            continue;
          }

          break;
        }

        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: '', depth: 0, isGlob: false };

          if (finished === true) continue;
          if (prev === CHAR_DOT$1 && index === (start + 1)) {
            start += 2;
            continue;
          }

          lastIndex = index + 1;
          continue;
        }

        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS
            || code === CHAR_AT
            || code === CHAR_ASTERISK
            || code === CHAR_QUESTION_MARK
            || code === CHAR_EXCLAMATION_MARK;

          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES$1) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;

            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }

                if (code === CHAR_RIGHT_PARENTHESES$1) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }

        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;

          if (scanToEnd === true) {
            continue;
          }
          break;
        }

        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;

          if (scanToEnd === true) {
            continue;
          }
          break;
        }

        if (code === CHAR_LEFT_SQUARE_BRACKET$1) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }

            if (next === CHAR_RIGHT_SQUARE_BRACKET$1) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;

              if (scanToEnd === true) {
                continue;
              }
              break;
            }
          }
        }

        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }

        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES$1) {
          isGlob = token.isGlob = true;

          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES$1) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }

              if (code === CHAR_RIGHT_PARENTHESES$1) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }

        if (isGlob === true) {
          finished = true;

          if (scanToEnd === true) {
            continue;
          }

          break;
        }
      }

      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }

      let base = str;
      let prefix = '';
      let glob = '';

      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }

      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = '';
        glob = str;
      } else {
        base = str;
      }

      if (base && base !== '' && base !== '/' && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }

      if (opts.unescape === true) {
        if (glob) glob = utils$1.removeBackslashes(glob);

        if (base && backslashes === true) {
          base = utils$1.removeBackslashes(base);
        }
      }

      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated
      };

      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }

      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;

        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== '') {
            parts.push(value);
          }
          prevIndex = i;
        }

        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);

          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }

        state.slashes = slashes;
        state.parts = parts;
      }

      return state;
    };

    var scan_1 = scan;

    /**
     * Constants
     */

    const {
      MAX_LENGTH: MAX_LENGTH$1,
      POSIX_REGEX_SOURCE: POSIX_REGEX_SOURCE$1,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants$1;

    /**
     * Helpers
     */

    const expandRange = (args, options) => {
      if (typeof options.expandRange === 'function') {
        return options.expandRange(...args, options);
      }

      args.sort();
      const value = `[${args.join('-')}]`;

      try {
        /* eslint-disable-next-line no-new */
        new RegExp(value);
      } catch (ex) {
        return args.map(v => utils$1.escapeRegex(v)).join('..');
      }

      return value;
    };

    /**
     * Create the message for a syntax error
     */

    const syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };

    /**
     * Parse the given input string.
     * @param {String} input
     * @param {Object} options
     * @return {Object}
     */

    const parse$1 = (input, options) => {
      if (typeof input !== 'string') {
        throw new TypeError('Expected a string');
      }

      input = REPLACEMENTS[input] || input;

      const opts = { ...options };
      const max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH$1, opts.maxLength) : MAX_LENGTH$1;

      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }

      const bos = { type: 'bos', value: '', output: opts.prepend || '' };
      const tokens = [bos];

      const capture = opts.capture ? '' : '?:';
      const win32 = utils$1.isWindows(options);

      // create constants based on platform, for windows or posix
      const PLATFORM_CHARS = constants$1.globChars(win32);
      const EXTGLOB_CHARS = constants$1.extglobChars(PLATFORM_CHARS);

      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;

      const globstar = (opts) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };

      const nodot = opts.dot ? '' : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;

      if (opts.capture) {
        star = `(${star})`;
      }

      // minimatch options support
      if (typeof opts.noext === 'boolean') {
        opts.noextglob = opts.noext;
      }

      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: '',
        output: '',
        prefix: '',
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };

      input = utils$1.removePrefix(input, state);
      len = input.length;

      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;

      /**
       * Tokenizing helpers
       */

      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index];
      const remaining = () => input.slice(state.index + 1);
      const consume = (value = '', num = 0) => {
        state.consumed += value;
        state.index += num;
      };
      const append = token => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };

      const negate = () => {
        let count = 1;

        while (peek() === '!' && (peek(2) !== '(' || peek(3) === '?')) {
          advance();
          state.start++;
          count++;
        }

        if (count % 2 === 0) {
          return false;
        }

        state.negated = true;
        state.start++;
        return true;
      };

      const increment = type => {
        state[type]++;
        stack.push(type);
      };

      const decrement = type => {
        state[type]--;
        stack.pop();
      };

      /**
       * Push tokens onto the tokens array. This helper speeds up
       * tokenizing by 1) helping us avoid backtracking as much as possible,
       * and 2) helping us avoid creating extra tokens when consecutive
       * characters are plain text. This improves performance and simplifies
       * lookbehinds.
       */

      const push = tok => {
        if (prev.type === 'globstar') {
          const isBrace = state.braces > 0 && (tok.type === 'comma' || tok.type === 'brace');
          const isExtglob = tok.extglob === true || (extglobs.length && (tok.type === 'pipe' || tok.type === 'paren'));

          if (tok.type !== 'slash' && tok.type !== 'paren' && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = 'star';
            prev.value = '*';
            prev.output = star;
            state.output += prev.output;
          }
        }

        if (extglobs.length && tok.type !== 'paren' && !EXTGLOB_CHARS[tok.value]) {
          extglobs[extglobs.length - 1].inner += tok.value;
        }

        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === 'text' && tok.type === 'text') {
          prev.value += tok.value;
          prev.output = (prev.output || '') + tok.value;
          return;
        }

        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };

      const extglobOpen = (type, value) => {
        const token = { ...EXTGLOB_CHARS[value], conditions: 1, inner: '' };

        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        const output = (opts.capture ? '(' : '') + token.open;

        increment('parens');
        push({ type, value, output: state.output ? '' : ONE_CHAR });
        push({ type: 'paren', extglob: true, value: advance(), output });
        extglobs.push(token);
      };

      const extglobClose = token => {
        let output = token.close + (opts.capture ? ')' : '');

        if (token.type === 'negate') {
          let extglobStar = star;

          if (token.inner && token.inner.length > 1 && token.inner.includes('/')) {
            extglobStar = globstar(opts);
          }

          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }

          if (token.prev.type === 'bos' && eos()) {
            state.negatedExtglob = true;
          }
        }

        push({ type: 'paren', extglob: true, value, output });
        decrement('parens');
      };

      /**
       * Fast paths
       */

      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;

        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === '\\') {
            backslashes = true;
            return m;
          }

          if (first === '?') {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : '');
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : '');
            }
            return QMARK.repeat(chars.length);
          }

          if (first === '.') {
            return DOT_LITERAL.repeat(chars.length);
          }

          if (first === '*') {
            if (esc) {
              return esc + first + (rest ? star : '');
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });

        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, '');
          } else {
            output = output.replace(/\\+/g, m => {
              return m.length % 2 === 0 ? '\\\\' : (m ? '\\' : '');
            });
          }
        }

        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }

        state.output = utils$1.wrapOutput(output, state, options);
        return state;
      }

      /**
       * Tokenize input until we reach end-of-string
       */

      while (!eos()) {
        value = advance();

        if (value === '\u0000') {
          continue;
        }

        /**
         * Escaped characters
         */

        if (value === '\\') {
          const next = peek();

          if (next === '/' && opts.bash !== true) {
            continue;
          }

          if (next === '.' || next === ';') {
            continue;
          }

          if (!next) {
            value += '\\';
            push({ type: 'text', value });
            continue;
          }

          // collapse slashes to reduce potential for exploits
          const match = /^\\+/.exec(remaining());
          let slashes = 0;

          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += '\\';
            }
          }

          if (opts.unescape === true) {
            value = advance() || '';
          } else {
            value += advance() || '';
          }

          if (state.brackets === 0) {
            push({ type: 'text', value });
            continue;
          }
        }

        /**
         * If we're inside a regex character class, continue
         * until we reach the closing bracket.
         */

        if (state.brackets > 0 && (value !== ']' || prev.value === '[' || prev.value === '[^')) {
          if (opts.posix !== false && value === ':') {
            const inner = prev.value.slice(1);
            if (inner.includes('[')) {
              prev.posix = true;

              if (inner.includes(':')) {
                const idx = prev.value.lastIndexOf('[');
                const pre = prev.value.slice(0, idx);
                const rest = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE$1[rest];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();

                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }

          if ((value === '[' && peek() !== ':') || (value === '-' && peek() === ']')) {
            value = `\\${value}`;
          }

          if (value === ']' && (prev.value === '[' || prev.value === '[^')) {
            value = `\\${value}`;
          }

          if (opts.posix === true && value === '!' && prev.value === '[') {
            value = '^';
          }

          prev.value += value;
          append({ value });
          continue;
        }

        /**
         * If we're inside a quoted string, continue
         * until we reach the closing double quote.
         */

        if (state.quotes === 1 && value !== '"') {
          value = utils$1.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }

        /**
         * Double quotes
         */

        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: 'text', value });
          }
          continue;
        }

        /**
         * Parentheses
         */

        if (value === '(') {
          increment('parens');
          push({ type: 'paren', value });
          continue;
        }

        if (value === ')') {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError('opening', '('));
          }

          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }

          push({ type: 'paren', value, output: state.parens ? ')' : '\\)' });
          decrement('parens');
          continue;
        }

        /**
         * Square brackets
         */

        if (value === '[') {
          if (opts.nobracket === true || !remaining().includes(']')) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError('closing', ']'));
            }

            value = `\\${value}`;
          } else {
            increment('brackets');
          }

          push({ type: 'bracket', value });
          continue;
        }

        if (value === ']') {
          if (opts.nobracket === true || (prev && prev.type === 'bracket' && prev.value.length === 1)) {
            push({ type: 'text', value, output: `\\${value}` });
            continue;
          }

          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError('opening', '['));
            }

            push({ type: 'text', value, output: `\\${value}` });
            continue;
          }

          decrement('brackets');

          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === '^' && !prevValue.includes('/')) {
            value = `/${value}`;
          }

          prev.value += value;
          append({ value });

          // when literal brackets are explicitly disabled
          // assume we should match with a regex character class
          if (opts.literalBrackets === false || utils$1.hasRegexChars(prevValue)) {
            continue;
          }

          const escaped = utils$1.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);

          // when literal brackets are explicitly enabled
          // assume we should escape the brackets to match literal characters
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }

          // when the user specifies nothing, try to match both
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }

        /**
         * Braces
         */

        if (value === '{' && opts.nobrace !== true) {
          increment('braces');

          const open = {
            type: 'brace',
            value,
            output: '(',
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };

          braces.push(open);
          push(open);
          continue;
        }

        if (value === '}') {
          const brace = braces[braces.length - 1];

          if (opts.nobrace === true || !brace) {
            push({ type: 'text', value, output: value });
            continue;
          }

          let output = ')';

          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];

            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === 'brace') {
                break;
              }
              if (arr[i].type !== 'dots') {
                range.unshift(arr[i].value);
              }
            }

            output = expandRange(range, opts);
            state.backtrack = true;
          }

          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = '\\{';
            value = output = '\\}';
            state.output = out;
            for (const t of toks) {
              state.output += (t.output || t.value);
            }
          }

          push({ type: 'brace', value, output });
          decrement('braces');
          braces.pop();
          continue;
        }

        /**
         * Pipes
         */

        if (value === '|') {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: 'text', value });
          continue;
        }

        /**
         * Commas
         */

        if (value === ',') {
          let output = value;

          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === 'braces') {
            brace.comma = true;
            output = '|';
          }

          push({ type: 'comma', value, output });
          continue;
        }

        /**
         * Slashes
         */

        if (value === '/') {
          // if the beginning of the glob is "./", advance the start
          // to the current index, and don't add the "./" characters
          // to the state. This greatly simplifies lookbehinds when
          // checking for BOS characters like "!" and "." (not "./")
          if (prev.type === 'dot' && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = '';
            state.output = '';
            tokens.pop();
            prev = bos; // reset "prev" to the first token
            continue;
          }

          push({ type: 'slash', value, output: SLASH_LITERAL });
          continue;
        }

        /**
         * Dots
         */

        if (value === '.') {
          if (state.braces > 0 && prev.type === 'dot') {
            if (prev.value === '.') prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = 'dots';
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }

          if ((state.braces + state.parens) === 0 && prev.type !== 'bos' && prev.type !== 'slash') {
            push({ type: 'text', value, output: DOT_LITERAL });
            continue;
          }

          push({ type: 'dot', value, output: DOT_LITERAL });
          continue;
        }

        /**
         * Question marks
         */

        if (value === '?') {
          const isGroup = prev && prev.value === '(';
          if (!isGroup && opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
            extglobOpen('qmark', value);
            continue;
          }

          if (prev && prev.type === 'paren') {
            const next = peek();
            let output = value;

            if (next === '<' && !utils$1.supportsLookbehinds()) {
              throw new Error('Node.js v10 or higher is required for regex lookbehinds');
            }

            if ((prev.value === '(' && !/[!=<:]/.test(next)) || (next === '<' && !/<([!=]|\w+>)/.test(remaining()))) {
              output = `\\${value}`;
            }

            push({ type: 'text', value, output });
            continue;
          }

          if (opts.dot !== true && (prev.type === 'slash' || prev.type === 'bos')) {
            push({ type: 'qmark', value, output: QMARK_NO_DOT });
            continue;
          }

          push({ type: 'qmark', value, output: QMARK });
          continue;
        }

        /**
         * Exclamation
         */

        if (value === '!') {
          if (opts.noextglob !== true && peek() === '(') {
            if (peek(2) !== '?' || !/[!=<:]/.test(peek(3))) {
              extglobOpen('negate', value);
              continue;
            }
          }

          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }

        /**
         * Plus
         */

        if (value === '+') {
          if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
            extglobOpen('plus', value);
            continue;
          }

          if ((prev && prev.value === '(') || opts.regex === false) {
            push({ type: 'plus', value, output: PLUS_LITERAL });
            continue;
          }

          if ((prev && (prev.type === 'bracket' || prev.type === 'paren' || prev.type === 'brace')) || state.parens > 0) {
            push({ type: 'plus', value });
            continue;
          }

          push({ type: 'plus', value: PLUS_LITERAL });
          continue;
        }

        /**
         * Plain text
         */

        if (value === '@') {
          if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
            push({ type: 'at', extglob: true, value, output: '' });
            continue;
          }

          push({ type: 'text', value });
          continue;
        }

        /**
         * Plain text
         */

        if (value !== '*') {
          if (value === '$' || value === '^') {
            value = `\\${value}`;
          }

          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }

          push({ type: 'text', value });
          continue;
        }

        /**
         * Stars
         */

        if (prev && (prev.type === 'globstar' || prev.star === true)) {
          prev.type = 'star';
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }

        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen('star', value);
          continue;
        }

        if (prev.type === 'star') {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }

          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === 'slash' || prior.type === 'bos';
          const afterStar = before && (before.type === 'star' || before.type === 'globstar');

          if (opts.bash === true && (!isStart || (rest[0] && rest[0] !== '/'))) {
            push({ type: 'star', value, output: '' });
            continue;
          }

          const isBrace = state.braces > 0 && (prior.type === 'comma' || prior.type === 'brace');
          const isExtglob = extglobs.length && (prior.type === 'pipe' || prior.type === 'paren');
          if (!isStart && prior.type !== 'paren' && !isBrace && !isExtglob) {
            push({ type: 'star', value, output: '' });
            continue;
          }

          // strip consecutive `/**/`
          while (rest.slice(0, 3) === '/**') {
            const after = input[state.index + 4];
            if (after && after !== '/') {
              break;
            }
            rest = rest.slice(3);
            consume('/**', 3);
          }

          if (prior.type === 'bos' && eos()) {
            prev.type = 'globstar';
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }

          if (prior.type === 'slash' && prior.prev.type !== 'bos' && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;

            prev.type = 'globstar';
            prev.output = globstar(opts) + (opts.strictSlashes ? ')' : '|$)');
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }

          if (prior.type === 'slash' && prior.prev.type !== 'bos' && rest[0] === '/') {
            const end = rest[1] !== void 0 ? '|$' : '';

            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;

            prev.type = 'globstar';
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;

            state.output += prior.output + prev.output;
            state.globstar = true;

            consume(value + advance());

            push({ type: 'slash', value: '/', output: '' });
            continue;
          }

          if (prior.type === 'bos' && rest[0] === '/') {
            prev.type = 'globstar';
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: 'slash', value: '/', output: '' });
            continue;
          }

          // remove single star from output
          state.output = state.output.slice(0, -prev.output.length);

          // reset previous token to globstar
          prev.type = 'globstar';
          prev.output = globstar(opts);
          prev.value += value;

          // reset output with globstar
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }

        const token = { type: 'star', value, output: star };

        if (opts.bash === true) {
          token.output = '.*?';
          if (prev.type === 'bos' || prev.type === 'slash') {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }

        if (prev && (prev.type === 'bracket' || prev.type === 'paren') && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }

        if (state.index === state.start || prev.type === 'slash' || prev.type === 'dot') {
          if (prev.type === 'dot') {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;

          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;

          } else {
            state.output += nodot;
            prev.output += nodot;
          }

          if (peek() !== '*') {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }

        push(token);
      }

      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ']'));
        state.output = utils$1.escapeLast(state.output, '[');
        decrement('brackets');
      }

      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ')'));
        state.output = utils$1.escapeLast(state.output, '(');
        decrement('parens');
      }

      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', '}'));
        state.output = utils$1.escapeLast(state.output, '{');
        decrement('braces');
      }

      if (opts.strictSlashes !== true && (prev.type === 'star' || prev.type === 'bracket')) {
        push({ type: 'maybe_slash', value: '', output: `${SLASH_LITERAL}?` });
      }

      // rebuild the output if we had to backtrack at any point
      if (state.backtrack === true) {
        state.output = '';

        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;

          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }

      return state;
    };

    /**
     * Fast paths for creating regular expressions for common glob patterns.
     * This can significantly speed up processing and has very little downside
     * impact when none of the fast paths match.
     */

    parse$1.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH$1, opts.maxLength) : MAX_LENGTH$1;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }

      input = REPLACEMENTS[input] || input;
      const win32 = utils$1.isWindows(options);

      // create constants based on platform, for windows or posix
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants$1.globChars(win32);

      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? '' : '?:';
      const state = { negated: false, prefix: '' };
      let star = opts.bash === true ? '.*?' : STAR;

      if (opts.capture) {
        star = `(${star})`;
      }

      const globstar = (opts) => {
        if (opts.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };

      const create = str => {
        switch (str) {
          case '*':
            return `${nodot}${ONE_CHAR}${star}`;

          case '.*':
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;

          case '*.*':
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;

          case '*/*':
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;

          case '**':
            return nodot + globstar(opts);

          case '**/*':
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;

          case '**/*.*':
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;

          case '**/.*':
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;

          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;

            const source = create(match[1]);
            if (!source) return;

            return source + DOT_LITERAL + match[2];
          }
        }
      };

      const output = utils$1.removePrefix(input, state);
      let source = create(output);

      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }

      return source;
    };

    var parse_1$1 = parse$1;

    const isObject$2 = val => val && typeof val === 'object' && !Array.isArray(val);

    /**
     * Creates a matcher function from one or more glob patterns. The
     * returned function takes a string to match as its first argument,
     * and returns true if the string is a match. The returned matcher
     * function also takes a boolean as the second argument that, when true,
     * returns an object with additional information.
     *
     * ```js
     * const picomatch = require('picomatch');
     * // picomatch(glob[, options]);
     *
     * const isMatch = picomatch('*.!(*a)');
     * console.log(isMatch('a.a')); //=> false
     * console.log(isMatch('a.b')); //=> true
     * ```
     * @name picomatch
     * @param {String|Array} `globs` One or more glob patterns.
     * @param {Object=} `options`
     * @return {Function=} Returns a matcher function.
     * @api public
     */

    const picomatch = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map(input => picomatch(input, options, returnState));
        const arrayMatcher = str => {
          for (const isMatch of fns) {
            const state = isMatch(str);
            if (state) return state;
          }
          return false;
        };
        return arrayMatcher;
      }

      const isState = isObject$2(glob) && glob.tokens && glob.input;

      if (glob === '' || (typeof glob !== 'string' && !isState)) {
        throw new TypeError('Expected pattern to be a non-empty string');
      }

      const opts = options || {};
      const posix = utils$1.isWindows(options);
      const regex = isState
        ? picomatch.compileRe(glob, options)
        : picomatch.makeRe(glob, options, false, true);

      const state = regex.state;
      delete regex.state;

      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
      }

      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output, match, isMatch };

        if (typeof opts.onResult === 'function') {
          opts.onResult(result);
        }

        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }

        if (isIgnored(input)) {
          if (typeof opts.onIgnore === 'function') {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }

        if (typeof opts.onMatch === 'function') {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };

      if (returnState) {
        matcher.state = state;
      }

      return matcher;
    };

    /**
     * Test `input` with the given `regex`. This is used by the main
     * `picomatch()` function to test the input string.
     *
     * ```js
     * const picomatch = require('picomatch');
     * // picomatch.test(input, regex[, options]);
     *
     * console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
     * // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
     * ```
     * @param {String} `input` String to test.
     * @param {RegExp} `regex`
     * @return {Object} Returns an object with matching info.
     * @api public
     */

    picomatch.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== 'string') {
        throw new TypeError('Expected input to be a string');
      }

      if (input === '') {
        return { isMatch: false, output: '' };
      }

      const opts = options || {};
      const format = opts.format || (posix ? utils$1.toPosixSlashes : null);
      let match = input === glob;
      let output = (match && format) ? format(input) : input;

      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }

      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }

      return { isMatch: Boolean(match), match, output };
    };

    /**
     * Match the basename of a filepath.
     *
     * ```js
     * const picomatch = require('picomatch');
     * // picomatch.matchBase(input, glob[, options]);
     * console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
     * ```
     * @param {String} `input` String to test.
     * @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
     * @return {Boolean}
     * @api public
     */

    picomatch.matchBase = (input, glob, options, posix = utils$1.isWindows(options)) => {
      const regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
      return regex.test(path$2.basename(input));
    };

    /**
     * Returns true if **any** of the given glob `patterns` match the specified `string`.
     *
     * ```js
     * const picomatch = require('picomatch');
     * // picomatch.isMatch(string, patterns[, options]);
     *
     * console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
     * console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
     * ```
     * @param {String|Array} str The string to test.
     * @param {String|Array} patterns One or more glob patterns to use for matching.
     * @param {Object} [options] See available [options](#options).
     * @return {Boolean} Returns true if any patterns match `str`
     * @api public
     */

    picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);

    /**
     * Parse a glob pattern to create the source string for a regular
     * expression.
     *
     * ```js
     * const picomatch = require('picomatch');
     * const result = picomatch.parse(pattern[, options]);
     * ```
     * @param {String} `pattern`
     * @param {Object} `options`
     * @return {Object} Returns an object with useful properties and output to be used as a regex source string.
     * @api public
     */

    picomatch.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map(p => picomatch.parse(p, options));
      return parse_1$1(pattern, { ...options, fastpaths: false });
    };

    /**
     * Scan a glob pattern to separate the pattern into segments.
     *
     * ```js
     * const picomatch = require('picomatch');
     * // picomatch.scan(input[, options]);
     *
     * const result = picomatch.scan('!./foo/*.js');
     * console.log(result);
     * { prefix: '!./',
     *   input: '!./foo/*.js',
     *   start: 3,
     *   base: 'foo',
     *   glob: '*.js',
     *   isBrace: false,
     *   isBracket: false,
     *   isGlob: true,
     *   isExtglob: false,
     *   isGlobstar: false,
     *   negated: true }
     * ```
     * @param {String} `input` Glob pattern to scan.
     * @param {Object} `options`
     * @return {Object} Returns an object with
     * @api public
     */

    picomatch.scan = (input, options) => scan_1(input, options);

    /**
     * Create a regular expression from a parsed glob pattern.
     *
     * ```js
     * const picomatch = require('picomatch');
     * const state = picomatch.parse('*.js');
     * // picomatch.compileRe(state[, options]);
     *
     * console.log(picomatch.compileRe(state));
     * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
     * ```
     * @param {String} `state` The object returned from the `.parse` method.
     * @param {Object} `options`
     * @return {RegExp} Returns a regex created from the given pattern.
     * @api public
     */

    picomatch.compileRe = (parsed, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return parsed.output;
      }

      const opts = options || {};
      const prepend = opts.contains ? '' : '^';
      const append = opts.contains ? '' : '$';

      let source = `${prepend}(?:${parsed.output})${append}`;
      if (parsed && parsed.negated === true) {
        source = `^(?!${source}).*$`;
      }

      const regex = picomatch.toRegex(source, options);
      if (returnState === true) {
        regex.state = parsed;
      }

      return regex;
    };

    picomatch.makeRe = (input, options, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== 'string') {
        throw new TypeError('Expected a non-empty string');
      }

      const opts = options || {};
      let parsed = { negated: false, fastpaths: true };
      let prefix = '';
      let output;

      if (input.startsWith('./')) {
        input = input.slice(2);
        prefix = parsed.prefix = './';
      }

      if (opts.fastpaths !== false && (input[0] === '.' || input[0] === '*')) {
        output = parse_1$1.fastpaths(input, options);
      }

      if (output === undefined) {
        parsed = parse_1$1(input, options);
        parsed.prefix = prefix + (parsed.prefix || '');
      } else {
        parsed.output = output;
      }

      return picomatch.compileRe(parsed, options, returnOutput, returnState);
    };

    /**
     * Create a regular expression from the given regex source string.
     *
     * ```js
     * const picomatch = require('picomatch');
     * // picomatch.toRegex(source[, options]);
     *
     * const { output } = picomatch.parse('*.js');
     * console.log(picomatch.toRegex(output));
     * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
     * ```
     * @param {String} `source` Regular expression source string.
     * @param {Object} `options`
     * @return {RegExp}
     * @api public
     */

    picomatch.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? 'i' : ''));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };

    /**
     * Picomatch constants.
     * @return {Object}
     */

    picomatch.constants = constants$1;

    /**
     * Expose "picomatch"
     */

    var picomatch_1 = picomatch;

    var picomatch$1 = picomatch_1;

    const isEmptyString = val => typeof val === 'string' && (val === '' || val === './');

    /**
     * Returns an array of strings that match one or more glob patterns.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm(list, patterns[, options]);
     *
     * console.log(mm(['a.js', 'a.txt'], ['*.js']));
     * //=> [ 'a.js' ]
     * ```
     * @param {String|Array<string>} list List of strings to match.
     * @param {String|Array<string>} patterns One or more glob patterns to use for matching.
     * @param {Object} options See available [options](#options)
     * @return {Array} Returns an array of matches
     * @summary false
     * @api public
     */

    const micromatch = (list, patterns, options) => {
      patterns = [].concat(patterns);
      list = [].concat(list);

      let omit = new Set();
      let keep = new Set();
      let items = new Set();
      let negatives = 0;

      let onResult = state => {
        items.add(state.output);
        if (options && options.onResult) {
          options.onResult(state);
        }
      };

      for (let i = 0; i < patterns.length; i++) {
        let isMatch = picomatch$1(String(patterns[i]), { ...options, onResult }, true);
        let negated = isMatch.state.negated || isMatch.state.negatedExtglob;
        if (negated) negatives++;

        for (let item of list) {
          let matched = isMatch(item, true);

          let match = negated ? !matched.isMatch : matched.isMatch;
          if (!match) continue;

          if (negated) {
            omit.add(matched.output);
          } else {
            omit.delete(matched.output);
            keep.add(matched.output);
          }
        }
      }

      let result = negatives === patterns.length ? [...items] : [...keep];
      let matches = result.filter(item => !omit.has(item));

      if (options && matches.length === 0) {
        if (options.failglob === true) {
          throw new Error(`No matches found for "${patterns.join(', ')}"`);
        }

        if (options.nonull === true || options.nullglob === true) {
          return options.unescape ? patterns.map(p => p.replace(/\\/g, '')) : patterns;
        }
      }

      return matches;
    };

    /**
     * Backwards compatibility
     */

    micromatch.match = micromatch;

    /**
     * Returns a matcher function from the given glob `pattern` and `options`.
     * The returned function takes a string to match as its only argument and returns
     * true if the string is a match.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.matcher(pattern[, options]);
     *
     * const isMatch = mm.matcher('*.!(*a)');
     * console.log(isMatch('a.a')); //=> false
     * console.log(isMatch('a.b')); //=> true
     * ```
     * @param {String} `pattern` Glob pattern
     * @param {Object} `options`
     * @return {Function} Returns a matcher function.
     * @api public
     */

    micromatch.matcher = (pattern, options) => picomatch$1(pattern, options);

    /**
     * Returns true if **any** of the given glob `patterns` match the specified `string`.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.isMatch(string, patterns[, options]);
     *
     * console.log(mm.isMatch('a.a', ['b.*', '*.a'])); //=> true
     * console.log(mm.isMatch('a.a', 'b.*')); //=> false
     * ```
     * @param {String} str The string to test.
     * @param {String|Array} patterns One or more glob patterns to use for matching.
     * @param {Object} [options] See available [options](#options).
     * @return {Boolean} Returns true if any patterns match `str`
     * @api public
     */

    micromatch.isMatch = (str, patterns, options) => picomatch$1(patterns, options)(str);

    /**
     * Backwards compatibility
     */

    micromatch.any = micromatch.isMatch;

    /**
     * Returns a list of strings that _**do not match any**_ of the given `patterns`.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.not(list, patterns[, options]);
     *
     * console.log(mm.not(['a.a', 'b.b', 'c.c'], '*.a'));
     * //=> ['b.b', 'c.c']
     * ```
     * @param {Array} `list` Array of strings to match.
     * @param {String|Array} `patterns` One or more glob pattern to use for matching.
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Array} Returns an array of strings that **do not match** the given patterns.
     * @api public
     */

    micromatch.not = (list, patterns, options = {}) => {
      patterns = [].concat(patterns).map(String);
      let result = new Set();
      let items = [];

      let onResult = state => {
        if (options.onResult) options.onResult(state);
        items.push(state.output);
      };

      let matches = micromatch(list, patterns, { ...options, onResult });

      for (let item of items) {
        if (!matches.includes(item)) {
          result.add(item);
        }
      }
      return [...result];
    };

    /**
     * Returns true if the given `string` contains the given pattern. Similar
     * to [.isMatch](#isMatch) but the pattern can match any part of the string.
     *
     * ```js
     * var mm = require('micromatch');
     * // mm.contains(string, pattern[, options]);
     *
     * console.log(mm.contains('aa/bb/cc', '*b'));
     * //=> true
     * console.log(mm.contains('aa/bb/cc', '*d'));
     * //=> false
     * ```
     * @param {String} `str` The string to match.
     * @param {String|Array} `patterns` Glob pattern to use for matching.
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Boolean} Returns true if the patter matches any part of `str`.
     * @api public
     */

    micromatch.contains = (str, pattern, options) => {
      if (typeof str !== 'string') {
        throw new TypeError(`Expected a string: "${util$2.inspect(str)}"`);
      }

      if (Array.isArray(pattern)) {
        return pattern.some(p => micromatch.contains(str, p, options));
      }

      if (typeof pattern === 'string') {
        if (isEmptyString(str) || isEmptyString(pattern)) {
          return false;
        }

        if (str.includes(pattern) || (str.startsWith('./') && str.slice(2).includes(pattern))) {
          return true;
        }
      }

      return micromatch.isMatch(str, pattern, { ...options, contains: true });
    };

    /**
     * Filter the keys of the given object with the given `glob` pattern
     * and `options`. Does not attempt to match nested keys. If you need this feature,
     * use [glob-object][] instead.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.matchKeys(object, patterns[, options]);
     *
     * const obj = { aa: 'a', ab: 'b', ac: 'c' };
     * console.log(mm.matchKeys(obj, '*b'));
     * //=> { ab: 'b' }
     * ```
     * @param {Object} `object` The object with keys to filter.
     * @param {String|Array} `patterns` One or more glob patterns to use for matching.
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Object} Returns an object with only keys that match the given patterns.
     * @api public
     */

    micromatch.matchKeys = (obj, patterns, options) => {
      if (!utils$1.isObject(obj)) {
        throw new TypeError('Expected the first argument to be an object');
      }
      let keys = micromatch(Object.keys(obj), patterns, options);
      let res = {};
      for (let key of keys) res[key] = obj[key];
      return res;
    };

    /**
     * Returns true if some of the strings in the given `list` match any of the given glob `patterns`.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.some(list, patterns[, options]);
     *
     * console.log(mm.some(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
     * // true
     * console.log(mm.some(['foo.js'], ['*.js', '!foo.js']));
     * // false
     * ```
     * @param {String|Array} `list` The string or array of strings to test. Returns as soon as the first match is found.
     * @param {String|Array} `patterns` One or more glob patterns to use for matching.
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Boolean} Returns true if any patterns match `str`
     * @api public
     */

    micromatch.some = (list, patterns, options) => {
      let items = [].concat(list);

      for (let pattern of [].concat(patterns)) {
        let isMatch = picomatch$1(String(pattern), options);
        if (items.some(item => isMatch(item))) {
          return true;
        }
      }
      return false;
    };

    /**
     * Returns true if every string in the given `list` matches
     * any of the given glob `patterns`.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.every(list, patterns[, options]);
     *
     * console.log(mm.every('foo.js', ['foo.js']));
     * // true
     * console.log(mm.every(['foo.js', 'bar.js'], ['*.js']));
     * // true
     * console.log(mm.every(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
     * // false
     * console.log(mm.every(['foo.js'], ['*.js', '!foo.js']));
     * // false
     * ```
     * @param {String|Array} `list` The string or array of strings to test.
     * @param {String|Array} `patterns` One or more glob patterns to use for matching.
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Boolean} Returns true if any patterns match `str`
     * @api public
     */

    micromatch.every = (list, patterns, options) => {
      let items = [].concat(list);

      for (let pattern of [].concat(patterns)) {
        let isMatch = picomatch$1(String(pattern), options);
        if (!items.every(item => isMatch(item))) {
          return false;
        }
      }
      return true;
    };

    /**
     * Returns true if **all** of the given `patterns` match
     * the specified string.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.all(string, patterns[, options]);
     *
     * console.log(mm.all('foo.js', ['foo.js']));
     * // true
     *
     * console.log(mm.all('foo.js', ['*.js', '!foo.js']));
     * // false
     *
     * console.log(mm.all('foo.js', ['*.js', 'foo.js']));
     * // true
     *
     * console.log(mm.all('foo.js', ['*.js', 'f*', '*o*', '*o.js']));
     * // true
     * ```
     * @param {String|Array} `str` The string to test.
     * @param {String|Array} `patterns` One or more glob patterns to use for matching.
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Boolean} Returns true if any patterns match `str`
     * @api public
     */

    micromatch.all = (str, patterns, options) => {
      if (typeof str !== 'string') {
        throw new TypeError(`Expected a string: "${util$2.inspect(str)}"`);
      }

      return [].concat(patterns).every(p => picomatch$1(p, options)(str));
    };

    /**
     * Returns an array of matches captured by `pattern` in `string, or `null` if the pattern did not match.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.capture(pattern, string[, options]);
     *
     * console.log(mm.capture('test/*.js', 'test/foo.js'));
     * //=> ['foo']
     * console.log(mm.capture('test/*.js', 'foo/bar.css'));
     * //=> null
     * ```
     * @param {String} `glob` Glob pattern to use for matching.
     * @param {String} `input` String to match
     * @param {Object} `options` See available [options](#options) for changing how matches are performed
     * @return {Boolean} Returns an array of captures if the input matches the glob pattern, otherwise `null`.
     * @api public
     */

    micromatch.capture = (glob, input, options) => {
      let posix = utils$1.isWindows(options);
      let regex = picomatch$1.makeRe(String(glob), { ...options, capture: true });
      let match = regex.exec(posix ? utils$1.toPosixSlashes(input) : input);

      if (match) {
        return match.slice(1).map(v => v === void 0 ? '' : v);
      }
    };

    /**
     * Create a regular expression from the given glob `pattern`.
     *
     * ```js
     * const mm = require('micromatch');
     * // mm.makeRe(pattern[, options]);
     *
     * console.log(mm.makeRe('*.js'));
     * //=> /^(?:(\.[\\\/])?(?!\.)(?=.)[^\/]*?\.js)$/
     * ```
     * @param {String} `pattern` A glob pattern to convert to regex.
     * @param {Object} `options`
     * @return {RegExp} Returns a regex created from the given pattern.
     * @api public
     */

    micromatch.makeRe = (...args) => picomatch$1.makeRe(...args);

    /**
     * Scan a glob pattern to separate the pattern into segments. Used
     * by the [split](#split) method.
     *
     * ```js
     * const mm = require('micromatch');
     * const state = mm.scan(pattern[, options]);
     * ```
     * @param {String} `pattern`
     * @param {Object} `options`
     * @return {Object} Returns an object with
     * @api public
     */

    micromatch.scan = (...args) => picomatch$1.scan(...args);

    /**
     * Parse a glob pattern to create the source string for a regular
     * expression.
     *
     * ```js
     * const mm = require('micromatch');
     * const state = mm(pattern[, options]);
     * ```
     * @param {String} `glob`
     * @param {Object} `options`
     * @return {Object} Returns an object with useful properties and output to be used as regex source string.
     * @api public
     */

    micromatch.parse = (patterns, options) => {
      let res = [];
      for (let pattern of [].concat(patterns || [])) {
        for (let str of braces_1(String(pattern), options)) {
          res.push(picomatch$1.parse(str, options));
        }
      }
      return res;
    };

    /**
     * Process the given brace `pattern`.
     *
     * ```js
     * const { braces } = require('micromatch');
     * console.log(braces('foo/{a,b,c}/bar'));
     * //=> [ 'foo/(a|b|c)/bar' ]
     *
     * console.log(braces('foo/{a,b,c}/bar', { expand: true }));
     * //=> [ 'foo/a/bar', 'foo/b/bar', 'foo/c/bar' ]
     * ```
     * @param {String} `pattern` String with brace pattern to process.
     * @param {Object} `options` Any [options](#options) to change how expansion is performed. See the [braces][] library for all available options.
     * @return {Array}
     * @api public
     */

    micromatch.braces = (pattern, options) => {
      if (typeof pattern !== 'string') throw new TypeError('Expected a string');
      if ((options && options.nobrace === true) || !/\{.*\}/.test(pattern)) {
        return [pattern];
      }
      return braces_1(pattern, options);
    };

    /**
     * Expand braces
     */

    micromatch.braceExpand = (pattern, options) => {
      if (typeof pattern !== 'string') throw new TypeError('Expected a string');
      return micromatch.braces(pattern, { ...options, expand: true });
    };

    /**
     * Expose micromatch
     */

    var micromatch_1 = micromatch;

    function urlMatchesAnyGlobOf(url, patterns) {
        return micromatch_1.contains(url, patterns);
    }

    //
    //
    // Variables
    //
    var pressedKeys = new Set();
    var settings;
    var triggerKeyIsPressed = false;
    var overflowValuesThatEnableScrollbarsOnContentElements = ['auto', 'overlay', 'scroll'];
    //
    // Init
    //
    loadSettings(function () {
        attachPageFocusLossListener();
        attachKeysListeners();
        attachWheelListener();
        console.debug('[fast-scroll] ready', window.location.href);
    });
    //
    // Helpers
    //
    function attachPageFocusLossListener() {
        /* clear pressed keys when the page loses focus, because by default they stay pressed when tab-switching to another
        OS window, which causes unexpected scrolling behavior when returning to the browser */
        window.addEventListener('blur', function () {
            pressedKeys.clear();
            triggerKeyIsPressed = false;
        });
    }
    function attachKeysListeners() {
        window.addEventListener('keydown', function (event) {
            pressedKeys.add(event.code);
            triggerKeyIsPressed = pressedKeys.has(settings.triggerKey);
        });
        window.addEventListener('keyup', function (event) {
            pressedKeys["delete"](event.code);
            triggerKeyIsPressed = pressedKeys.has(settings.triggerKey);
        });
        /* By default, on Windows (but not on Linux), Google Chrome uses the Alt Left key to focus the browser's menu button,
        which interferes with Fast Scroll because the web page loses focus when Alt Left is released so you can't press it
        multiple times in a row to scroll faster, you have to click on the page so it regains focus everytime. So we're
        preventing this default behavior when Alt Left is used as the trigger key. */
        var preventAltLeftDefault = settings.triggerKey === Settings.TriggerKey.AltLeft;
        if (preventAltLeftDefault) {
            window.addEventListener('keyup', function (event) {
                if (event.code === Settings.TriggerKey.AltLeft)
                    event.preventDefault();
            }, { passive: false });
        }
    }
    function attachWheelListener() {
        if (settings.mode === Settings.Mode.OnTriggerKeyPressed)
            window.addEventListener('wheel', onWheelModeOnTriggerKeyPressed, { passive: false });
        else if (settings.mode === Settings.Mode.Always)
            window.addEventListener('wheel', onWheelModeAlways, { passive: false });
        else
            throw new Error("Unknown mode '" + settings.mode + "'");
    }
    function elementIsScrollable(element, axis) {
        var elementComputedStyle = window.getComputedStyle(element);
        if (axis === 'horizontal') {
            // if the element is as big as its content, it can't be scrolled (and doesn't need to)
            if (element.scrollWidth === element.clientWidth)
                return false;
            // <body> and <html> elements are scrollable as long as their overflow content isn't hidden
            if (element instanceof HTMLBodyElement || element instanceof HTMLHtmlElement)
                return true;
            // other elements are scrollable only when their 'overflow-<axis>' CSS attr has a value that enables scrollbars
            return overflowValuesThatEnableScrollbarsOnContentElements.includes(elementComputedStyle.overflowX);
        }
        else {
            // if the element is as big as its content, it can't be scrolled (and doesn't need to)
            if (element.scrollHeight === element.clientHeight)
                return false;
            // <body> and <html> elements are scrollable as long as their overflow content isn't hidden
            if (element instanceof HTMLBodyElement || element instanceof HTMLHtmlElement)
                return true;
            // other elements are scrollable only when their 'overflow-<axis>' CSS attr has a value that enables scrollbars
            return overflowValuesThatEnableScrollbarsOnContentElements.includes(elementComputedStyle.overflowY);
        }
    }
    /**
     * @returns The first element in the `element`'s hierarchy (including the element itself) that has a scrollbar for the
     * given `axis`, or `null` if none has any.
     */
    function findScrollTarget(element, axis) {
        if (element === document.body) {
            /* On some websites the <body> element is seen as scrollable by Fast Scroll but `body.scrollBy()` does nothing,
            however as per my tests in all these cases `document.scrollingElement.scrollBy()` does work (with `scrollingElement`
            being the <html> element). That's why we check if `document.scrollingElement` is scrollable before checking the
            <body>. */
            if (elementIsScrollable(document.scrollingElement, axis))
                return document.scrollingElement;
        }
        if (elementIsScrollable(element, axis))
            return element;
        else if (element.parentElement)
            return findScrollTarget(element.parentElement, axis);
        return null;
    }
    function handleScroll(event, speed) {
        event.preventDefault();
        var scrollAmount = (function () {
            /* When scrolling to the bottom or to the right, `event.deltaY` will be a positive int ; when scrolling to the top or
            to the left, it will be a negative int.
            During my tests `event.deltaX` never changed and was always `0`, but I think that's because my mouse has a
            unidirectional wheel, while some other mouses can be have a bidirectional wheel, that's why I'm checking it ‒ to
            [hopefully] support all possible use cases */
            var scrollAmountDefault = event.deltaY || event.deltaX;
            if (speed === 'custom')
                return scrollAmountDefault * settings.scrollSpeedMultiplier;
            else if (speed === 'default')
                return scrollAmountDefault;
        })();
        /* Use the first scrollable element in the target's hierachy's instead of `window` to allow to scroll faster not only
        in the page itself but also in inner elements, like text areas or divs with overflow content. This also allows the
        extension to work on websites like Trello where the scrollable area isn't the <body> nor <html> element but a child
        element. */
        var axis = (settings.triggerKey !== Settings.TriggerKey.ShiftLeft
            && (pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')))
            ? 'horizontal' : 'vertical';
        var scrollTarget = findScrollTarget(event.target, axis) || window; // if no scrollable element is found fallback to `window`
        if (axis === 'horizontal')
            scrollTarget.scrollBy(scrollAmount, 0);
        else
            scrollTarget.scrollBy(0, scrollAmount);
    }
    function loadSettings(callback) {
        // load saved settings
        chrome.storage.sync.get(defaultSettings, function (savedSettings) {
            settings = savedSettings;
            // if current URL doesn't match any ignore glob
            if (!urlMatchesAnyGlobOf(window.location.href, settings.ignoredUrls))
                callback();
        });
        // listen to changes
        chrome.storage.onChanged.addListener(function (changes) {
            if (changes.mode)
                settings.mode = changes.mode.newValue;
            if (changes.scrollSpeedMultiplier)
                settings.scrollSpeedMultiplier = changes.scrollSpeedMultiplier.newValue;
            if (changes.triggerKey)
                settings.triggerKey = changes.triggerKey.newValue;
        });
    }
    function onWheelModeAlways(event) {
        // brackets are important here because of this: https://gist.github.com/flawyte/e7e39d1d48aa1d5e7512b21bb8429b1f
        if (triggerKeyIsPressed) {
            if (settings.triggerKey === Settings.TriggerKey.ControlLeft)
                handleScroll(event, 'default'); // handle normal scroll by ourself since by default ControlLeft is used to zoom in/out on the page
            else if (settings.triggerKey === Settings.TriggerKey.ShiftLeft)
                handleScroll(event, 'default'); // handle normal scroll by ourself since by default ShiftLeft is used to scroll horizontally
        }
        else if (!pressedKeys.has('ControlLeft')) // pass if ControlLeft is pressed to preserve default zoom in/out behavior
            handleScroll(event, 'custom');
    }
    function onWheelModeOnTriggerKeyPressed(event) {
        if (triggerKeyIsPressed)
            handleScroll(event, 'custom');
    }

}());
