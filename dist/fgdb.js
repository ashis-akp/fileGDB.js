/*
The MIT License (MIT)

Copyright (c) 2013 Calvin Metcalf

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f()
  } else if (typeof define === "function" && define.amd) {
    define([], f)
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window
    } else if (typeof global !== "undefined") {
      g = global
    } else if (typeof self !== "undefined") {
      g = self
    } else {
      g = this
    }
    g.fgdb = f()
  }
})(function () {
  var define, module, exports;
  return (function e(t, n, r) {
    function s(o, u) {
      if (!n[o]) {
        if (!t[o]) {
          var a = typeof require == "function" && require;
          if (!u && a) return a(o, !0);
          if (i) return i(o, !0);
          var f = new Error("Cannot find module '" + o + "'");
          throw f.code = "MODULE_NOT_FOUND", f
        }
        var l = n[o] = {
          exports: {}
        };
        t[o][0].call(l.exports, function (e) {
          var n = t[o][1][e];
          return s(n ? n : e)
        }, l, l.exports, e, t, n, r)
      }
      return n[o].exports
    }
    var i = typeof require == "function" && require;
    for (var o = 0; o < r.length; o++) s(r[o]);
    return s
  })({
    1: [function (require, module, exports) {
      'use strict';
      var Promise = require('lie');

      function binaryAjax(url) {
        return new Promise(function (resolve, reject) {
          var ajax = new XMLHttpRequest();
          ajax.open('GET', url, true);
          ajax.responseType = 'arraybuffer';
          ajax.addEventListener('load', function () {
            if (ajax.status > 399) {
              return reject(ajax.status);
            }
            resolve(ajax.response);
          }, false);
          ajax.send();
        });
      }
      module.exports = binaryAjax;

    }, {
      "lie": 37
    }],
    2: [function (require, module, exports) {
      'use strict';
      var Promise = require('lie');
      var read = require('./read');
      var toArray = require('./util').toArray;

      function handleFile(file) {
        return new Promise(function (done) {
          var reader = new FileReader();
          reader.onload = function () {
            done(reader.result);
          };
          reader.readAsArrayBuffer(file);
        });
      }
      module.exports = function (fileList) {

        return new Promise(function (yes, no) {
          var tableA = {};
          var tablxA = {};
          var i = 0;
          var len = fileList.length;
          while (i < len) {
            if (fileList[i].name.slice(-9) === '.gdbtable' && (parseInt(fileList[i].name.slice(1, -9), 16) === 1 || parseInt(fileList[i].name.slice(1, -9), 16) > 8)) {
              tableA[parseInt(fileList[i].name.slice(1, -9), 16)] = fileList[i];
            } else if (fileList[i].name.slice(-9) === '.gdbtablx' && (parseInt(fileList[i].name.slice(1, -9), 16) === 1 || parseInt(fileList[i].name.slice(1, -9), 16) > 8)) {
              tablxA[parseInt(fileList[i].name.slice(1, -9), 16)] = fileList[i];
            }
            i++;
          }
          var table = toArray(tableA);
          var tablx = toArray(tablxA);

          function readFile(num) {
            return Promise.all([handleFile(table[num]), handleFile(tablx[num])]).then(function (buffs) {
              return read(buffs[0], buffs[1]);
            });
          }
          readFile(0).then(function (files) {
            var out = {};
            var i = 1;
            files.forEach(function (name) {
              if (name.Name.slice(0, 4) !== 'GDB_') {
                out[name.Name] = i++;
              }
            });
            return out;
          }).then(function (names) {
            var out = {};
            return Promise.all(Object.keys(names).map(function (key) {
              return readFile(names[key]).then(function (v) {
                out[key] = v;
              });
            })).then(function () {
              return out;
            });
          }).then(yes, no);
        });

      };

    }, {
      "./read": 8,
      "./util": 12,
      "lie": 37
    }],
    3: [function (require, module, exports) {
      'use strict';
      var Long = require('long');
      var l127 = Long.fromNumber(127, true);

      function makeLong(n) {
        return Long.fromNumber(n, true);
      }

      function Data(buffer, offset) {
        this.data = new DataView(buffer);
        this.offset = offset;
      }

      Data.prototype.getUint8 = function () {
        return this.data.getUint8(this.offset++);
      };
      //these two functions are ported somewhat directly from
      //http://trac.osgeo.org/gdal/attachment/wiki/FGDBSpecification/dump_gdbtable.py#L60
      Data.prototype.varuint = function () {
        //console.log('offset',this.offset);
        var ret = 0;
        var shift = -7;
        var b = 128;
        while (b & 128) {
          shift += 7;
          //console.log('shift',shift);
          b = this.getUint8();
          //.log('b',b);
          ret = l127.and(makeLong(b)).shiftLeft(shift).or(makeLong(ret)).toNumber();
          //console.log('ret',ret);
        }
        return ret;
      };
      Data.prototype.varint = function () {
        var b = this.getUint8();
        var ret = (b & 63);
        var sign = 1;
        if (b & 64) {
          sign = -1;
        }
        if (!(b & 128)) {
          return ret * sign;
        }
        var shift = -1;
        while (b & 128) {
          shift += 7;
          b = this.getUint8();
          ret = l127.and(makeLong(b)).shiftLeft(shift).or(makeLong(ret)).toNumber();
        }
        return ret * sign;
      };
      Data.prototype.getUint16 = function () {
        var out = this.data.getUint16(this.offset, true);
        this.offset += 2;
        return out;
      };
      Data.prototype.getInt16 = function () {
        var out = this.data.getInt16(this.offset, true);
        this.offset += 2;
        return out;
      };
      Data.prototype.getUint32 = function () {
        var out = this.data.getUint32(this.offset, true);
        this.offset += 4;
        return out;
      };
      Data.prototype.getInt32 = function () {
        var out = this.data.getInt32(this.offset, true);
        this.offset += 4;
        return out;
      };
      Data.prototype.getFloat32 = function () {
        var out = this.data.getFloat32(this.offset, true);
        this.offset += 4;
        return out;
      };
      Data.prototype.getFloat64 = function () {
        var out = this.data.getFloat64(this.offset, true);
        this.offset += 8;
        return out;
      };
      module.exports = Data;

    }, {
      "long": 39
    }],
    4: [function (require, module, exports) {
      'use strict';
      module.exports = function (days) {
        //convert excel days since 12/30/1899 to JavaScript ms since 1/1/1970
        var unixDays = days - 25569; //days between two dates
        var ms = unixDays * 864e5; //milliseconds per day
        return new Date(ms);
      };

    }, {}],
    5: [function (require, module, exports) {
      'use strict';
      var proj4 = require('proj4');
      var fileHeader = require('./table');

      function get2(offset, data) {
        var out = {
          meta: {
            nullable: true
          }
        };
        out.meta.len = data.getUint8(offset++, true);
        out.meta.flag = data.getUint8(offset++, true);
        if ((out.meta.flag & 1) === 0) {
          out.meta.nullable = false;
        }
        out.offset = offset;
        return out;
      }

      function get3(offset, data) {
        var out = {
          meta: {
            nullable: true
          }
        };
        out.meta.len = data.getUint8(offset++, true);
        out.meta.flag = data.getUint8(offset++, true);
        if ((out.meta.flag & 1) === 0) {
          out.meta.nullable = false;
        }
        out.offset = ++offset;
        return out;
      }
      var dataHeaders = [
        get3, //int16
        get3, //int32
        get3, //flaot32
        get3, //float64
        function (offset, data) {
          //string
          var out = {
            meta: {
              nullable: true
            }
          };
          out.meta.len = data.getUint32(offset, true);
          offset += 4;
          out.meta.flag = data.getUint8(offset++, true);
          if ((out.meta.flag & 1) === 0) {
            out.meta.nullable = false;
          }
          if ((out.meta.flag & 4) !== 0) {
            out.meta.def_length = data.getUint8(offset, true);
            offset += out.meta.def_length;
          }

          out.offset = ++offset;
          return out;
        },
        get3, //datetime
        function (offset) {
          //oid
          var out = {
            meta: {}
          };
          offset++;
          offset++;
          out.meta.nullable = false;
          out.offset = offset;
          return out;
        },
        function (offset, data) {
          //shape
          offset += 1;
          var out = {
            meta: {
              nullable: true
            }
          };
          out.meta.flag = data.getUint8(offset++, true);
          if ((out.meta.flag & 1) === 0) {
            out.meta.nullable = false;
          }
          var srsLen = data.getUint16(offset, true);
          offset += 2;
          var i = 0;
          out.meta.wkt = '';
          var char;
          while (i < srsLen) {
            char = data.getUint8(offset++, true);
            if (char) {
              out.meta.wkt += String.fromCharCode(char);
            }
            i++;
          }
          if (out.meta.wkt) {
            out.meta.proj = proj4(out.meta.wkt);
          }
          var magic = data.getUint8(offset++, true);
          out.meta.origin = [];
          out.meta.origin.push(data.getFloat64(offset, true));
          offset += 8;
          out.meta.origin.push(data.getFloat64(offset, true));
          offset += 8;
          var xyScale = data.getFloat64(offset, true);
          offset += 8;
          out.meta.scale = [xyScale, xyScale];
          if (magic !== 1) {
            out.meta.origin.push(data.getFloat64(offset, true));
            offset += 8;
            out.meta.scale.push(data.getFloat64(offset, true));
            offset += 8;
            if (magic !== 5) {
              out.meta.origin.push(data.getFloat64(offset, true));
              offset += 8;
              out.meta.scale.push(data.getFloat64(offset, true));
              offset += 8;
            }
          }
          var xytolerance = data.getFloat64(offset, true);
          out.meta.tolerance = [xytolerance, xytolerance];
          offset += 8;
          if (magic !== 1) {
            out.meta.tolerance.push(data.getFloat64(offset, true));
            offset += 8;
            if (magic !== 5) {
              out.meta.tolerance.push(data.getFloat64(offset, true));
              offset += 8;
            }
            i = 4;
            out.meta.extent = [];
            while (i--) {
              out.meta.extent.push(data.getFloat64(offset, true));
              offset += 8;
            }
          }
          //console.log('tolerance',out.meta.tolerance);
          //console.log('extent',out.meta.extent);
          function testMagic3(num) {
            return num === 0;
          }
          var magic2, magic3;
          while (true) {
            magic2 = data.getUint8(offset + 1, true);
            magic3 = [data.getUint8(offset, true), data.getUint8(offset + 2, true), data.getUint8(offset + 3, true), data.getUint8(offset + 4, true)];
            //console.log('magic2',magic2);
            if (magic2 < 5 && magic2 > 0 && magic3.every(testMagic3)) {
              offset += 5;
              offset += (magic2 * 8);
              break;
            } else {
              offset += 8;
            }
          }
          out.offset = offset;
          return out;
        },
        function (offset, data) {
          //binary
          var out = {
            meta: {
              nullable: true
            }
          };

          offset++;
          out.meta.flag = data.getUint8(offset++, true);
          if ((out.meta.flag & 1) === 0) {
            out.meta.nullable = false;
          }
          out.offset = offset;
          return out;
        },
        null,
        get2, //UUID
        get2, //UUID
        get2 //xml
      ];

      function parseFields(buffer) {
        var headers = fileHeader(buffer);
        var data = new DataView(buffer, headers.fdOffset);
        var out = {};
        out.size = data.getUint32(0 << 2, true);
        out.version = data.getUint32(1 << 2, true);
        out.geometry = data.getUint8(2 << 2, true);
        out.num = data.getUint16(3 << 2, true);
        out.fields = [];
        out.nullableFields = 0;
        var offset = 14;
        out.geometry = false;
        var i = 0;
        var cur;
        var j;
        var temp;
        while (i < out.num) {
          cur = {};
          //console.log('offset',offset);
          cur.chars = data.getUint8(offset++, true);
          while (cur.chars === 0) {
            cur.chars = data.getUint8(offset++, true);
          }
          cur.title = '';
          j = 0;
          while (j < cur.chars) {
            cur.title += String.fromCharCode(data.getUint16(offset, true));
            j++;
            offset += 2;
          }
          //console.log('title',cur.title);
          cur.chars = data.getUint8(offset++, true);
          if (cur.chars > 0) {
            cur.alias = '';
            j = 0;
            while (j < cur.chars) {
              cur.alias += String.fromCharCode(data.getUint16(offset, true));
              j++;
              offset += 2;
            }
            //console.log('alias',cur.alias);
          }
          cur.type = data.getUint8(offset++, true);
          //console.log('type',cur.type);
          if (!dataHeaders[cur.type]) {
            throw new Error('not a real type');
          }
          temp = dataHeaders[cur.type](offset, data);
          offset = temp.offset;
          cur.meta = temp.meta;
          if (cur.type === 7) {
            out.geometry = true;
            out.bbox = cur.meta.extent;
          }
          if (cur.meta.nullable) {
            out.nullableFields++;
            cur.nullable = true;
          }
          out.fields[i++] = cur;
        }
        out.offset = offset;
        return out;
      }
      module.exports = parseFields;

    }, {
      "./table": 10,
      "proj4": 41
    }],
    6: [function (require, module, exports) {
      (function (process) {
        'use strict';
        var JSZip = require('jszip');
        var toArray = require('./util').toArray;
        var read = require('./read');
        var Promise = require('lie');
        module.exports = function (buffer) {
          return new Promise(function (yes) {
            var zip = new JSZip(buffer);
            var unzippedFiles = zip.file(/a0{1,7}(?:[^2-8]|[190a-z]|(?:[1-9a-z]+[0-9a-z]+))\.(?:gdbtable|gdbtablx)/);
            var tableA = {};
            var tablxA = {};
            unzippedFiles.forEach(function (file) {
              if (file.name.slice(-9) === '.gdbtable' && (parseInt(file.name.slice(-17, -9), 16) === 1 || parseInt(file.name.slice(-17, -9), 16) > 8)) {
                tableA[parseInt(file.name.slice(-17, -9), 16)] = file;
              } else if (file.name.slice(-9) === '.gdbtablx' && (parseInt(file.name.slice(-17, -9), 16) === 1 || parseInt(file.name.slice(-17, -9), 16) > 8)) {
                tablxA[parseInt(file.name.slice(-17, -9), 16)] = file;
              }
            });
            var table = toArray(tableA);
            var tablx = toArray(tablxA);

            function readFile(num) {
              if (process.browser) {
                return read(table[num].asArrayBuffer(), tablx[num].asArrayBuffer());
              } else {
                return read(table[num].asNodeBuffer(), tablx[num].asNodeBuffer());
              }
            }
            var files = readFile(0);
            var names = {};
            var i = 1;
            files.forEach(function (name) {
              if (name.Name.slice(0, 4) !== 'GDB_') {
                names[name.Name] = i++;
              }
            });
            var out = {};
            Object.keys(names).forEach(function (key) {
              out[key] = readFile(names[key]);
            });

            yes(out);

          });
        };

      }).call(this, require('_process'))
    }, {
      "./read": 8,
      "./util": 12,
      "_process": 40,
      "jszip": 26,
      "lie": 37
    }],
    7: [function (require, module, exports) {
      'use strict';
      var Long = require('long');

      function checkIt(check, num) {
        return !Long.fromNumber(num, true).and(check);
      }
      var zCheck = Long.fromNumber(0x80000000, true);
      var mCheck = Long.fromNumber(0x40000000, true);
      var cCheck = Long.fromNumber(0x20000000, true);

      function isClockWise(array) {
        var sum = 0;
        var i = 1;
        var len = array.length;
        var prev, cur;
        while (i < len) {
          prev = cur || array[0];
          cur = array[i];
          sum += ((cur[0] - prev[0]) * (cur[1] + prev[1]));
          i++;
        }
        return sum > 0;
      }

      function polyReduce(a, b) {
        if (isClockWise(b) || !a.length) {
          a.push([b]);
        } else {
          a[a.length - 1].push(b);
        }
        return a;
      }
      var types = {
        11: {
          base: 'point',
          m: true,
          z: true
        },
        10: {
          base: 'line',
          m: false,
          z: true
        },
        13: {
          base: 'line',
          m: true,
          z: true
        },
        15: {
          base: 'polygon',
          m: true,
          z: true
        },
        21: {
          base: 'point',
          m: true,
          z: false
        },
        23: {
          base: 'line',
          m: true,
          z: false
        },
        19: {
          base: 'polygon',
          m: false,
          z: true
        },
        18: {
          base: 'mpoint',
          m: true,
          z: true
        },
        28: {
          base: 'mpoint',
          m: true,
          z: false
        },
        20: {
          base: 'mpoint',
          m: false,
          z: true
        },
        1: {
          base: 'point',
          m: false,
          z: false
        },
        3: {
          base: 'line',
          m: false,
          z: false
        },
        5: {
          base: 'polygon',
          m: false,
          z: false
        },
        25: {
          base: 'polygon',
          m: true,
          z: false
        },
        9: {
          base: 'point',
          m: false,
          z: true
        },
        8: {
          base: 'mpoint',
          m: false,
          z: false
        }
      };

      function MakePoint(meta) {
        this.origin = meta.origin;
        this.scale = meta.scale;
        this.min = Math.min(this.origin.length, this.scale.length);

        // function addit(v, i) {
        //   if (i >= this.tmin) {
        //     return;
        //   }
        //   return v / this.scale[i] + this.origin[i];
        // }

        function reduceit(v, i) {
          if (i >= this.rmin) {
            return undefined;
          }
          this.accumulater[i] += (v / this.scale[i]);
          return this.accumulater[i];
        }
        this.convert = function (point, origin) {
          origin = origin || this.origin;
          var scale = this.scale;
          var tmin = Math.min(point.length, this.min);
          return point.map(function (v, i) {
            if (i >= tmin) {
              return undefined;
            }
            return v / scale[i] + origin[i];
          }, this);
        };
        this.reduceBegin = function (point) {
          var npoint = this.convert(point);
          this.accumulater = npoint.slice();
          this.line = [npoint];
        };
        this.reduce = function (point) {
          this.rmin = Math.min(point.length, this.min, this.accumulater.length);
          this.line.push(point.map(reduceit, this));
        };
      }
      module.exports = function (data, row) {
        function getU(shape) {
          var raw = [];
          raw.push(data.varuint()); //x
          raw.push(data.varuint()); //y
          if (shape.base === 'point') {
            if (shape.z) {
              raw.push(data.varuint());
            }
            if (shape.m) {
              raw.push(data.varuint());
            }
          }
          return raw;
        }

        function getI(shape) {
          var raw = [];
          raw.push(data.varint()); //x
          raw.push(data.varint()); //y
          if (shape.base === 'point') {
            if (shape.z) {
              raw.push(data.varint());
            }
            if (shape.m) {
              raw.push(data.varint());
            }
          }
          return raw;
        }
        var converter;
        if (row.meta.proj) {
          converter = function (point) {
            return row.meta.proj.inverse(point);
          };
        } else {
          converter = function (point) {
            return point;
          };
        }

        var makePoint = new MakePoint(row.meta);

        function typeFuncs(shape) {
          if (shape.base === 'point' || shape.base === 'mpoint') {
            return typeFuncs[shape.base](shape);
          } else {
            return typeFuncs.complex(shape);
          }
        }
        typeFuncs.point = function (shape) {
          return {
            type: 'Point',
            coordinates: converter(makePoint.convert(getU(shape)))
          };
        };
        typeFuncs.mpoint = function (shape) {
          var len = data.varuint();
          //console.log('len', len);
          var mins = [data.varuint(), data.varuint()];
          var maxes = [data.varuint(), data.varuint()];
          var bbox = makePoint.convert(mins).concat(makePoint.convert(maxes, makePoint.convert(mins)));
          //console.log('mins', makePoint.convert(mins));
          //console.log('maxes', makePoint.convert(maxes, makePoint.convert(mins)));
          var i = 1;
          var point1 = getI(shape);
          var points = [];
          while (i++ < len) {
            points.push(getI(shape));
          }
          if (shape.z) {
            point1.push(data.varint());
            i = 1;
            while (i < len) {
              points[i - 1].push(data.varint());
              i++;
            }
          }
          makePoint.reduceBegin(point1);
          points.forEach(function (v) {
            makePoint.reduce(v);
          });
          var outPoints = makePoint.line.map(converter);
          if (outPoints.length === 1) {
            return {
              type: 'Point',
              coordinates: outPoints[0]
            };
          } else if (outPoints.length > 1) {
            return {
              bbox: bbox,
              type: 'MultiPoint',
              coordinates: outPoints
            };
          } else {
            return false;
          }
        };
        typeFuncs.complex = function (shape) {
          var points = data.varuint();
          var tPoints = points;
          var parts = data.varuint();
          var mins = [data.varuint(), data.varuint()];
          var maxes = [data.varuint(), data.varuint()];
          var bbox = makePoint.convert(mins).concat(makePoint.convert(maxes, makePoint.convert(mins)));
          var i = 1;
          var lens = [];
          var tlen;
          while (i++ < parts) {
            tlen = data.varuint();
            tPoints -= tlen;
            lens.push(tlen);
          }
          lens.push(tPoints);
          var lines = [];
          var rawLines = [];
          var part = -1;
          var point = 1;
          var point1 = getI(shape);
          while (++part < parts) {
            rawLines[part] = [];
            while (point++ < lens[part]) {
              rawLines[part].push(getI(shape));
            }
            point = 0;
          }
          if (shape.z) {
            point1.push(data.varint());
            point = 1;
            while (++part < parts) {
              while (point < lens[part]) {
                rawLines[part][point].push(data.varint());
                point++;
              }
              point = 0;
            }
          }
          makePoint.reduceBegin(point1);
          rawLines.forEach(function (rawPart) {
            rawPart.forEach(function (rawPoint) {
              makePoint.reduce(rawPoint);
            });
            if (shape.base === 'polygon') {
              makePoint.line.push(makePoint.line[0]);
            }
            lines.push(makePoint.line.map(converter));
            makePoint.line = [];
          });
          var out = {};
          if (shape.base === 'line') {
            if (lines.length === 1) {
              return {
                bbox: bbox,
                type: 'LineString',
                coordinates: lines[0]
              };
            } else if (lines.length > 1) {
              return {
                bbox: bbox,
                type: 'MultiLineString',
                coordinates: lines
              };
            } else {
              return false;
            }
          } else if (shape.base === 'polygon') {
            out.bbox = bbox;
            out.coordinates = lines.reduce(polyReduce, []);
            if (out.coordinates.length === 1) {
              out.type = 'Polygon';
              out.coordinates = out.coordinates[0];
              return out;
            } else {
              out.type = 'MultiPolygon';
              return out;
            }
          }
        };
        var len = data.varuint();
        //console.log('len', len);
        if (!len) {
          return null;
        }
        var expectedOffset = len + data.offset;
        var type = data.varuint();
        var shape;
        if (!type) {
          //console.log(type + ' is not a real type');
          data.offset = expectedOffset;
          return false;
        } else if (types[type]) {
          shape = types[type];
        } else if (!(type & 255)) {
          if (checkIt(cCheck, type)) {
            data.offset = expectedOffset;
            return false;
          }
          shape = {
            base: 'line',
            z: checkIt(zCheck, type),
            m: checkIt(mCheck, type)
          };
        } else {
          data.offset = expectedOffset;
          return false;
        }
        shape = types[type];
        var geometry = typeFuncs(shape);
        data.offset = expectedOffset;
        return geometry;
      };

    }, {
      "long": 39
    }],
    8: [function (require, module, exports) {
      (function (process) {
        'use strict';
        var rows = require('./rows');
        var util = require('./util');
        module.exports = function (table, tablex) {
          if (!process.browser) {
            table = util.toArrayBuffer(table);
            tablex = util.toArrayBuffer(tablex);
          }
          return rows(table, tablex);
        };

      }).call(this, require('_process'))
    }, {
      "./rows": 9,
      "./util": 12,
      "_process": 40
    }],
    9: [function (require, module, exports) {
      'use strict';
      var convertDate = require('./date');
      var parseGeometry = require('./geometry');
      var Data = require('./dataType');
      var parseFields = require('./fields');
      var tablex = require('./tablex');

      function parseUUID(data) {
        //uuid
        var out = '';
        var x = 16;
        while (x--) {
          out += data.getUint8().toString(16);
        }
        return out;
      }

      function parseText(data) {
        //xml or string
        var str = '';
        var i = 0;
        var len = data.varuint();
        //console.log('len',len);
        while (i < len) {
          str += String.fromCharCode.call(false, data.getUint8());
          i++;
        }
        //console.log('str',str);
        return str;
      }
      var dataTypes = [
        function (data) {
          return data.getUint16();
        },
        function (data) {
          return data.getUint32();
        },
        function (data) {
          return data.getFloat32();
        },
        function (data) {
          return data.getFloat64();
        },
        parseText,
        function (data) {
          //date
          return convertDate(data.getFloat64());
        },
        function () {
          //oid
          return;
        },
        parseGeometry,
        function (data) {
          //binary
          var out = [];
          var i = 0;
          var len = data.varuint();
          while (i < len) {
            out.push(data.getUint8());
            i++;
          }
          return new ArrayBuffer(out);
        },
        null,
        parseUUID,
        parseUUID,
        parseText
      ];

      module.exports = function (buffer, bufferx) {
        var fieldInfo = parseFields(buffer);
        var rowOffsets = tablex(bufferx);
        var out = rowOffsets.map(function (offset) {
          //console.log('row',i);
          if (!offset) {
            return null;
          }
          var len = (new DataView(buffer, offset, 4)).getUint32(0, true);
          offset += 4;
          var data = new Data(buffer, offset, len);
          var flags = [];
          var nf = fieldInfo.nullableFields;
          var nullPlace = 0;
          var nullableThings = false;
          if (nf) {
            nullableThings = true;
            while (nf > 0) {
              flags.push(data.getUint8());
              nf -= 8;
            }
          }
          //console.log('flags',flags);
          var nullGeometry = false;
          var out = {};
          if (fieldInfo.geometry) {
            out.type = 'Feature';
            out.properties = {};
          }
          fieldInfo.fields.forEach(function (field) {
            //console.log('title',field.title);
            var test;
            if (nullableThings) {
              if (field.nullable) {
                //console.log('nullPlace',nullPlace);
                test = (flags[nullPlace >> 3] & (1 << (nullPlace % 8)));
                nullPlace++;
                if (test !== 0) {
                  return;
                }
              }
            }
            var row = dataTypes[field.type](data, field);
            //console.log('row',row);
            if (typeof row === 'undefined') {
              return;
            }
            if (fieldInfo.geometry) {
              if (field.type === 7) {
                if (row) {
                  out.geometry = row;
                  if (out.geometry.bbox) {
                    out.bbox = out.geometry.bbox;
                    delete out.geometry.bbox;
                  }
                  //console.log(row);
                } else {
                  nullGeometry = true;
                  return;
                }
              } else {
                out.properties[field.title] = row;
              }
            } else {
              out[field.title] = row;
            }
          });
          if (nullGeometry) {
            return false;
          } else {
            return out;
          }

        }).filter(function (row) {
          return row;
        });
        if (fieldInfo.geometry) {
          return {
            type: 'FeatureCollection',
            features: out,
            bbox: fieldInfo.bbox
          };
        } else {
          return out;
        }
      };

    }, {
      "./dataType": 3,
      "./date": 4,
      "./fields": 5,
      "./geometry": 7,
      "./tablex": 11
    }],
    10: [function (require, module, exports) {
      'use strict';
      module.exports = function (buffer) {
        var data = new Uint32Array(buffer, 0, 40);
        return {
          rows: data[1],
          fileSize: data[6],
          fdOffset: data[8]
        };
      };

    }, {}],
    11: [function (require, module, exports) {
      'use strict';
      module.exports = function (buffer) {
        var data = new DataView(buffer);
        var offset = 8;
        var rows = [];
        var len = data.getUint32(offset, true);
        offset += 8; //yes 8
        var i = 0;
        while (i < len) {
          rows[i++] = data.getUint32(offset, true);
          offset += 5; //yes 5
        }
        return rows;
      };

    }, {}],
    12: [function (require, module, exports) {
      'use strict';
      exports.toArrayBuffer = function (buffer) {
        var len = buffer.length;
        var view = new Uint8Array(new ArrayBuffer(len));
        var i = -1;
        while (++i < len) {
          view[i] = buffer[i];
        }
        return view.buffer;
      };

      exports.toArray = function (obj) {
        var keys = Object.keys(obj);
        keys.sort(function (a, b) {
          return a - b;
        });
        var out = [];
        keys.forEach(function (a) {
          out.push(obj[a]);
        });
        return out;
      };

    }, {}],
    13: [function (require, module, exports) {
      var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

      ;
      (function (exports) {
        'use strict';

        var Arr = (typeof Uint8Array !== 'undefined') ?
          Uint8Array :
          Array

        var PLUS = '+'.charCodeAt(0)
        var SLASH = '/'.charCodeAt(0)
        var NUMBER = '0'.charCodeAt(0)
        var LOWER = 'a'.charCodeAt(0)
        var UPPER = 'A'.charCodeAt(0)
        var PLUS_URL_SAFE = '-'.charCodeAt(0)
        var SLASH_URL_SAFE = '_'.charCodeAt(0)

        function decode(elt) {
          var code = elt.charCodeAt(0)
          if (code === PLUS ||
            code === PLUS_URL_SAFE)
            return 62 // '+'
          if (code === SLASH ||
            code === SLASH_URL_SAFE)
            return 63 // '/'
          if (code < NUMBER)
            return -1 //no match
          if (code < NUMBER + 10)
            return code - NUMBER + 26 + 26
          if (code < UPPER + 26)
            return code - UPPER
          if (code < LOWER + 26)
            return code - LOWER + 26
        }

        function b64ToByteArray(b64) {
          var i, j, l, tmp, placeHolders, arr

          if (b64.length % 4 > 0) {
            throw new Error('Invalid string. Length must be a multiple of 4')
          }

          // the number of equal signs (place holders)
          // if there are two placeholders, than the two characters before it
          // represent one byte
          // if there is only one, then the three characters before it represent 2 bytes
          // this is just a cheap hack to not do indexOf twice
          var len = b64.length
          placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

          // base64 is 4/3 + up to two characters of the original data
          arr = new Arr(b64.length * 3 / 4 - placeHolders)

          // if there are placeholders, only get up to the last complete 4 chars
          l = placeHolders > 0 ? b64.length - 4 : b64.length

          var L = 0

          function push(v) {
            arr[L++] = v
          }

          for (i = 0, j = 0; i < l; i += 4, j += 3) {
            tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
            push((tmp & 0xFF0000) >> 16)
            push((tmp & 0xFF00) >> 8)
            push(tmp & 0xFF)
          }

          if (placeHolders === 2) {
            tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
            push(tmp & 0xFF)
          } else if (placeHolders === 1) {
            tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
            push((tmp >> 8) & 0xFF)
            push(tmp & 0xFF)
          }

          return arr
        }

        function uint8ToBase64(uint8) {
          var i,
            extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
            output = "",
            temp, length

          function encode(num) {
            return lookup.charAt(num)
          }

          function tripletToBase64(num) {
            return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
          }

          // go through the array every three bytes, we'll deal with trailing stuff later
          for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
            temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
            output += tripletToBase64(temp)
          }

          // pad the end with zeros, but make sure to not forget the extra bytes
          switch (extraBytes) {
            case 1:
              temp = uint8[uint8.length - 1]
              output += encode(temp >> 2)
              output += encode((temp << 4) & 0x3F)
              output += '=='
              break
            case 2:
              temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
              output += encode(temp >> 10)
              output += encode((temp >> 4) & 0x3F)
              output += encode((temp << 2) & 0x3F)
              output += '='
              break
          }

          return output
        }

        exports.toByteArray = b64ToByteArray
        exports.fromByteArray = uint8ToBase64
      }(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

    }, {}],
    14: [function (require, module, exports) {
      (function (global) {
        /*!
         * The buffer module from node.js, for the browser.
         *
         * @author   Feross Aboukhadijeh <http://feross.org>
         * @license  MIT
         */
        /* eslint-disable no-proto */

        'use strict'

        var base64 = require('base64-js')
        var ieee754 = require('ieee754')
        var isArray = require('isarray')

        exports.Buffer = Buffer
        exports.SlowBuffer = SlowBuffer
        exports.INSPECT_MAX_BYTES = 50
        Buffer.poolSize = 8192 // not used by this implementation

        var rootParent = {}

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
         *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
         *     on objects.
         *
         *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
         *
         *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
         *     incorrect length in some situations.

         * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
         * get the Object implementation, which is slower but behaves correctly.
         */
        Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined ?
          global.TYPED_ARRAY_SUPPORT :
          typedArraySupport()

        function typedArraySupport() {
          function Bar() {}
          try {
            var arr = new Uint8Array(1)
            arr.foo = function () {
              return 42
            }
            arr.constructor = Bar
            return arr.foo() === 42 && // typed array instances can be augmented
              arr.constructor === Bar && // constructor can be set
              typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
              arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
          } catch (e) {
            return false
          }
        }

        function kMaxLength() {
          return Buffer.TYPED_ARRAY_SUPPORT ?
            0x7fffffff :
            0x3fffffff
        }

        /**
         * Class: Buffer
         * =============
         *
         * The Buffer constructor returns instances of `Uint8Array` that are augmented
         * with function properties for all the node `Buffer` API functions. We use
         * `Uint8Array` so that square bracket notation works as expected -- it returns
         * a single octet.
         *
         * By augmenting the instances, we can avoid modifying the `Uint8Array`
         * prototype.
         */
        function Buffer(arg) {
          if (!(this instanceof Buffer)) {
            // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
            if (arguments.length > 1) return new Buffer(arg, arguments[1])
            return new Buffer(arg)
          }

          if (!Buffer.TYPED_ARRAY_SUPPORT) {
            this.length = 0
            this.parent = undefined
          }

          // Common case.
          if (typeof arg === 'number') {
            return fromNumber(this, arg)
          }

          // Slightly less common case.
          if (typeof arg === 'string') {
            return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
          }

          // Unusual.
          return fromObject(this, arg)
        }

        function fromNumber(that, length) {
          that = allocate(that, length < 0 ? 0 : checked(length) | 0)
          if (!Buffer.TYPED_ARRAY_SUPPORT) {
            for (var i = 0; i < length; i++) {
              that[i] = 0
            }
          }
          return that
        }

        function fromString(that, string, encoding) {
          if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

          // Assumption: byteLength() return value is always < kMaxLength.
          var length = byteLength(string, encoding) | 0
          that = allocate(that, length)

          that.write(string, encoding)
          return that
        }

        function fromObject(that, object) {
          if (Buffer.isBuffer(object)) return fromBuffer(that, object)

          if (isArray(object)) return fromArray(that, object)

          if (object == null) {
            throw new TypeError('must start with number, buffer, array or string')
          }

          if (typeof ArrayBuffer !== 'undefined') {
            if (object.buffer instanceof ArrayBuffer) {
              return fromTypedArray(that, object)
            }
            if (object instanceof ArrayBuffer) {
              return fromArrayBuffer(that, object)
            }
          }

          if (object.length) return fromArrayLike(that, object)

          return fromJsonObject(that, object)
        }

        function fromBuffer(that, buffer) {
          var length = checked(buffer.length) | 0
          that = allocate(that, length)
          buffer.copy(that, 0, 0, length)
          return that
        }

        function fromArray(that, array) {
          var length = checked(array.length) | 0
          that = allocate(that, length)
          for (var i = 0; i < length; i += 1) {
            that[i] = array[i] & 255
          }
          return that
        }

        // Duplicate of fromArray() to keep fromArray() monomorphic.
        function fromTypedArray(that, array) {
          var length = checked(array.length) | 0
          that = allocate(that, length)
          // Truncating the elements is probably not what people expect from typed
          // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
          // of the old Buffer constructor.
          for (var i = 0; i < length; i += 1) {
            that[i] = array[i] & 255
          }
          return that
        }

        function fromArrayBuffer(that, array) {
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            // Return an augmented `Uint8Array` instance, for best performance
            array.byteLength
            that = Buffer._augment(new Uint8Array(array))
          } else {
            // Fallback: Return an object instance of the Buffer class
            that = fromTypedArray(that, new Uint8Array(array))
          }
          return that
        }

        function fromArrayLike(that, array) {
          var length = checked(array.length) | 0
          that = allocate(that, length)
          for (var i = 0; i < length; i += 1) {
            that[i] = array[i] & 255
          }
          return that
        }

        // Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
        // Returns a zero-length buffer for inputs that don't conform to the spec.
        function fromJsonObject(that, object) {
          var array
          var length = 0

          if (object.type === 'Buffer' && isArray(object.data)) {
            array = object.data
            length = checked(array.length) | 0
          }
          that = allocate(that, length)

          for (var i = 0; i < length; i += 1) {
            that[i] = array[i] & 255
          }
          return that
        }

        if (Buffer.TYPED_ARRAY_SUPPORT) {
          Buffer.prototype.__proto__ = Uint8Array.prototype
          Buffer.__proto__ = Uint8Array
        } else {
          // pre-set for values that may exist in the future
          Buffer.prototype.length = undefined
          Buffer.prototype.parent = undefined
        }

        function allocate(that, length) {
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            // Return an augmented `Uint8Array` instance, for best performance
            that = Buffer._augment(new Uint8Array(length))
            that.__proto__ = Buffer.prototype
          } else {
            // Fallback: Return an object instance of the Buffer class
            that.length = length
            that._isBuffer = true
          }

          var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
          if (fromPool) that.parent = rootParent

          return that
        }

        function checked(length) {
          // Note: cannot use `length < kMaxLength` here because that fails when
          // length is NaN (which is otherwise coerced to zero.)
          if (length >= kMaxLength()) {
            throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
              'size: 0x' + kMaxLength().toString(16) + ' bytes')
          }
          return length | 0
        }

        function SlowBuffer(subject, encoding) {
          if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

          var buf = new Buffer(subject, encoding)
          delete buf.parent
          return buf
        }

        Buffer.isBuffer = function isBuffer(b) {
          return !!(b != null && b._isBuffer)
        }

        Buffer.compare = function compare(a, b) {
          if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
            throw new TypeError('Arguments must be Buffers')
          }

          if (a === b) return 0

          var x = a.length
          var y = b.length

          var i = 0
          var len = Math.min(x, y)
          while (i < len) {
            if (a[i] !== b[i]) break

              ++i
          }

          if (i !== len) {
            x = a[i]
            y = b[i]
          }

          if (x < y) return -1
          if (y < x) return 1
          return 0
        }

        Buffer.isEncoding = function isEncoding(encoding) {
          switch (String(encoding).toLowerCase()) {
            case 'hex':
            case 'utf8':
            case 'utf-8':
            case 'ascii':
            case 'binary':
            case 'base64':
            case 'raw':
            case 'ucs2':
            case 'ucs-2':
            case 'utf16le':
            case 'utf-16le':
              return true
            default:
              return false
          }
        }

        Buffer.concat = function concat(list, length) {
          if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

          if (list.length === 0) {
            return new Buffer(0)
          }

          var i
          if (length === undefined) {
            length = 0
            for (i = 0; i < list.length; i++) {
              length += list[i].length
            }
          }

          var buf = new Buffer(length)
          var pos = 0
          for (i = 0; i < list.length; i++) {
            var item = list[i]
            item.copy(buf, pos)
            pos += item.length
          }
          return buf
        }

        function byteLength(string, encoding) {
          if (typeof string !== 'string') string = '' + string

          var len = string.length
          if (len === 0) return 0

          // Use a for loop to avoid recursion
          var loweredCase = false
          for (;;) {
            switch (encoding) {
              case 'ascii':
              case 'binary':
                // Deprecated
              case 'raw':
              case 'raws':
                return len
              case 'utf8':
              case 'utf-8':
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
                encoding = ('' + encoding).toLowerCase()
                loweredCase = true
            }
          }
        }
        Buffer.byteLength = byteLength

        function slowToString(encoding, start, end) {
          var loweredCase = false

          start = start | 0
          end = end === undefined || end === Infinity ? this.length : end | 0

          if (!encoding) encoding = 'utf8'
          if (start < 0) start = 0
          if (end > this.length) end = this.length
          if (end <= start) return ''

          while (true) {
            switch (encoding) {
              case 'hex':
                return hexSlice(this, start, end)

              case 'utf8':
              case 'utf-8':
                return utf8Slice(this, start, end)

              case 'ascii':
                return asciiSlice(this, start, end)

              case 'binary':
                return binarySlice(this, start, end)

              case 'base64':
                return base64Slice(this, start, end)

              case 'ucs2':
              case 'ucs-2':
              case 'utf16le':
              case 'utf-16le':
                return utf16leSlice(this, start, end)

              default:
                if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                encoding = (encoding + '').toLowerCase()
                loweredCase = true
            }
          }
        }

        Buffer.prototype.toString = function toString() {
          var length = this.length | 0
          if (length === 0) return ''
          if (arguments.length === 0) return utf8Slice(this, 0, length)
          return slowToString.apply(this, arguments)
        }

        Buffer.prototype.equals = function equals(b) {
          if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
          if (this === b) return true
          return Buffer.compare(this, b) === 0
        }

        Buffer.prototype.inspect = function inspect() {
          var str = ''
          var max = exports.INSPECT_MAX_BYTES
          if (this.length > 0) {
            str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
            if (this.length > max) str += ' ... '
          }
          return '<Buffer ' + str + '>'
        }

        Buffer.prototype.compare = function compare(b) {
          if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
          if (this === b) return 0
          return Buffer.compare(this, b)
        }

        Buffer.prototype.indexOf = function indexOf(val, byteOffset) {
          if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
          else if (byteOffset < -0x80000000) byteOffset = -0x80000000
          byteOffset >>= 0

          if (this.length === 0) return -1
          if (byteOffset >= this.length) return -1

          // Negative offsets start from the end of the buffer
          if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

          if (typeof val === 'string') {
            if (val.length === 0) return -1 // special case: looking for empty string always fails
            return String.prototype.indexOf.call(this, val, byteOffset)
          }
          if (Buffer.isBuffer(val)) {
            return arrayIndexOf(this, val, byteOffset)
          }
          if (typeof val === 'number') {
            if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
              return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
            }
            return arrayIndexOf(this, [val], byteOffset)
          }

          function arrayIndexOf(arr, val, byteOffset) {
            var foundIndex = -1
            for (var i = 0; byteOffset + i < arr.length; i++) {
              if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
                if (foundIndex === -1) foundIndex = i
                if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
              } else {
                foundIndex = -1
              }
            }
            return -1
          }

          throw new TypeError('val must be string, number or Buffer')
        }

        // `get` is deprecated
        Buffer.prototype.get = function get(offset) {
          console.log('.get() is deprecated. Access using array indexes instead.')
          return this.readUInt8(offset)
        }

        // `set` is deprecated
        Buffer.prototype.set = function set(v, offset) {
          console.log('.set() is deprecated. Access using array indexes instead.')
          return this.writeUInt8(v, offset)
        }

        function hexWrite(buf, string, offset, length) {
          offset = Number(offset) || 0
          var remaining = buf.length - offset
          if (!length) {
            length = remaining
          } else {
            length = Number(length)
            if (length > remaining) {
              length = remaining
            }
          }

          // must be an even number of digits
          var strLen = string.length
          if (strLen % 2 !== 0) throw new Error('Invalid hex string')

          if (length > strLen / 2) {
            length = strLen / 2
          }
          for (var i = 0; i < length; i++) {
            var parsed = parseInt(string.substr(i * 2, 2), 16)
            if (isNaN(parsed)) throw new Error('Invalid hex string')
            buf[offset + i] = parsed
          }
          return i
        }

        function utf8Write(buf, string, offset, length) {
          return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
        }

        function asciiWrite(buf, string, offset, length) {
          return blitBuffer(asciiToBytes(string), buf, offset, length)
        }

        function binaryWrite(buf, string, offset, length) {
          return asciiWrite(buf, string, offset, length)
        }

        function base64Write(buf, string, offset, length) {
          return blitBuffer(base64ToBytes(string), buf, offset, length)
        }

        function ucs2Write(buf, string, offset, length) {
          return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
        }

        Buffer.prototype.write = function write(string, offset, length, encoding) {
          // Buffer#write(string)
          if (offset === undefined) {
            encoding = 'utf8'
            length = this.length
            offset = 0
            // Buffer#write(string, encoding)
          } else if (length === undefined && typeof offset === 'string') {
            encoding = offset
            length = this.length
            offset = 0
            // Buffer#write(string, offset[, length][, encoding])
          } else if (isFinite(offset)) {
            offset = offset | 0
            if (isFinite(length)) {
              length = length | 0
              if (encoding === undefined) encoding = 'utf8'
            } else {
              encoding = length
              length = undefined
            }
            // legacy write(string, encoding, offset, length) - remove in v0.13
          } else {
            var swap = encoding
            encoding = offset
            offset = length | 0
            length = swap
          }

          var remaining = this.length - offset
          if (length === undefined || length > remaining) length = remaining

          if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
            throw new RangeError('attempt to write outside buffer bounds')
          }

          if (!encoding) encoding = 'utf8'

          var loweredCase = false
          for (;;) {
            switch (encoding) {
              case 'hex':
                return hexWrite(this, string, offset, length)

              case 'utf8':
              case 'utf-8':
                return utf8Write(this, string, offset, length)

              case 'ascii':
                return asciiWrite(this, string, offset, length)

              case 'binary':
                return binaryWrite(this, string, offset, length)

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
                encoding = ('' + encoding).toLowerCase()
                loweredCase = true
            }
          }
        }

        Buffer.prototype.toJSON = function toJSON() {
          return {
            type: 'Buffer',
            data: Array.prototype.slice.call(this._arr || this, 0)
          }
        }

        function base64Slice(buf, start, end) {
          if (start === 0 && end === buf.length) {
            return base64.fromByteArray(buf)
          } else {
            return base64.fromByteArray(buf.slice(start, end))
          }
        }

        function utf8Slice(buf, start, end) {
          end = Math.min(buf.length, end)
          var res = []

          var i = start
          while (i < end) {
            var firstByte = buf[i]
            var codePoint = null
            var bytesPerSequence = (firstByte > 0xEF) ? 4 :
              (firstByte > 0xDF) ? 3 :
              (firstByte > 0xBF) ? 2 :
              1

            if (i + bytesPerSequence <= end) {
              var secondByte, thirdByte, fourthByte, tempCodePoint

              switch (bytesPerSequence) {
                case 1:
                  if (firstByte < 0x80) {
                    codePoint = firstByte
                  }
                  break
                case 2:
                  secondByte = buf[i + 1]
                  if ((secondByte & 0xC0) === 0x80) {
                    tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
                    if (tempCodePoint > 0x7F) {
                      codePoint = tempCodePoint
                    }
                  }
                  break
                case 3:
                  secondByte = buf[i + 1]
                  thirdByte = buf[i + 2]
                  if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                    tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
                    if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                      codePoint = tempCodePoint
                    }
                  }
                  break
                case 4:
                  secondByte = buf[i + 1]
                  thirdByte = buf[i + 2]
                  fourthByte = buf[i + 3]
                  if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                    tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
                    if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                      codePoint = tempCodePoint
                    }
                  }
              }
            }

            if (codePoint === null) {
              // we did not generate a valid codePoint so insert a
              // replacement char (U+FFFD) and advance only 1 byte
              codePoint = 0xFFFD
              bytesPerSequence = 1
            } else if (codePoint > 0xFFFF) {
              // encode to utf16 (surrogate pair dance)
              codePoint -= 0x10000
              res.push(codePoint >>> 10 & 0x3FF | 0xD800)
              codePoint = 0xDC00 | codePoint & 0x3FF
            }

            res.push(codePoint)
            i += bytesPerSequence
          }

          return decodeCodePointsArray(res)
        }

        // Based on http://stackoverflow.com/a/22747272/680742, the browser with
        // the lowest limit is Chrome, with 0x10000 args.
        // We go 1 magnitude less, for safety
        var MAX_ARGUMENTS_LENGTH = 0x1000

        function decodeCodePointsArray(codePoints) {
          var len = codePoints.length
          if (len <= MAX_ARGUMENTS_LENGTH) {
            return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
          }

          // Decode in chunks to avoid "call stack size exceeded".
          var res = ''
          var i = 0
          while (i < len) {
            res += String.fromCharCode.apply(
              String,
              codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
            )
          }
          return res
        }

        function asciiSlice(buf, start, end) {
          var ret = ''
          end = Math.min(buf.length, end)

          for (var i = start; i < end; i++) {
            ret += String.fromCharCode(buf[i] & 0x7F)
          }
          return ret
        }

        function binarySlice(buf, start, end) {
          var ret = ''
          end = Math.min(buf.length, end)

          for (var i = start; i < end; i++) {
            ret += String.fromCharCode(buf[i])
          }
          return ret
        }

        function hexSlice(buf, start, end) {
          var len = buf.length

          if (!start || start < 0) start = 0
          if (!end || end < 0 || end > len) end = len

          var out = ''
          for (var i = start; i < end; i++) {
            out += toHex(buf[i])
          }
          return out
        }

        function utf16leSlice(buf, start, end) {
          var bytes = buf.slice(start, end)
          var res = ''
          for (var i = 0; i < bytes.length; i += 2) {
            res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
          }
          return res
        }

        Buffer.prototype.slice = function slice(start, end) {
          var len = this.length
          start = ~~start
          end = end === undefined ? len : ~~end

          if (start < 0) {
            start += len
            if (start < 0) start = 0
          } else if (start > len) {
            start = len
          }

          if (end < 0) {
            end += len
            if (end < 0) end = 0
          } else if (end > len) {
            end = len
          }

          if (end < start) end = start

          var newBuf
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            newBuf = Buffer._augment(this.subarray(start, end))
          } else {
            var sliceLen = end - start
            newBuf = new Buffer(sliceLen, undefined)
            for (var i = 0; i < sliceLen; i++) {
              newBuf[i] = this[i + start]
            }
          }

          if (newBuf.length) newBuf.parent = this.parent || this

          return newBuf
        }

        /*
         * Need to make sure that buffer isn't trying to write out of bounds.
         */
        function checkOffset(offset, ext, length) {
          if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
          if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
        }

        Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
          offset = offset | 0
          byteLength = byteLength | 0
          if (!noAssert) checkOffset(offset, byteLength, this.length)

          var val = this[offset]
          var mul = 1
          var i = 0
          while (++i < byteLength && (mul *= 0x100)) {
            val += this[offset + i] * mul
          }

          return val
        }

        Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
          offset = offset | 0
          byteLength = byteLength | 0
          if (!noAssert) {
            checkOffset(offset, byteLength, this.length)
          }

          var val = this[offset + --byteLength]
          var mul = 1
          while (byteLength > 0 && (mul *= 0x100)) {
            val += this[offset + --byteLength] * mul
          }

          return val
        }

        Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 1, this.length)
          return this[offset]
        }

        Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 2, this.length)
          return this[offset] | (this[offset + 1] << 8)
        }

        Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 2, this.length)
          return (this[offset] << 8) | this[offset + 1]
        }

        Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 4, this.length)

          return ((this[offset]) |
              (this[offset + 1] << 8) |
              (this[offset + 2] << 16)) +
            (this[offset + 3] * 0x1000000)
        }

        Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 4, this.length)

          return (this[offset] * 0x1000000) +
            ((this[offset + 1] << 16) |
              (this[offset + 2] << 8) |
              this[offset + 3])
        }

        Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
          offset = offset | 0
          byteLength = byteLength | 0
          if (!noAssert) checkOffset(offset, byteLength, this.length)

          var val = this[offset]
          var mul = 1
          var i = 0
          while (++i < byteLength && (mul *= 0x100)) {
            val += this[offset + i] * mul
          }
          mul *= 0x80

          if (val >= mul) val -= Math.pow(2, 8 * byteLength)

          return val
        }

        Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
          offset = offset | 0
          byteLength = byteLength | 0
          if (!noAssert) checkOffset(offset, byteLength, this.length)

          var i = byteLength
          var mul = 1
          var val = this[offset + --i]
          while (i > 0 && (mul *= 0x100)) {
            val += this[offset + --i] * mul
          }
          mul *= 0x80

          if (val >= mul) val -= Math.pow(2, 8 * byteLength)

          return val
        }

        Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 1, this.length)
          if (!(this[offset] & 0x80)) return (this[offset])
          return ((0xff - this[offset] + 1) * -1)
        }

        Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 2, this.length)
          var val = this[offset] | (this[offset + 1] << 8)
          return (val & 0x8000) ? val | 0xFFFF0000 : val
        }

        Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 2, this.length)
          var val = this[offset + 1] | (this[offset] << 8)
          return (val & 0x8000) ? val | 0xFFFF0000 : val
        }

        Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 4, this.length)

          return (this[offset]) |
            (this[offset + 1] << 8) |
            (this[offset + 2] << 16) |
            (this[offset + 3] << 24)
        }

        Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 4, this.length)

          return (this[offset] << 24) |
            (this[offset + 1] << 16) |
            (this[offset + 2] << 8) |
            (this[offset + 3])
        }

        Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 4, this.length)
          return ieee754.read(this, offset, true, 23, 4)
        }

        Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 4, this.length)
          return ieee754.read(this, offset, false, 23, 4)
        }

        Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 8, this.length)
          return ieee754.read(this, offset, true, 52, 8)
        }

        Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
          if (!noAssert) checkOffset(offset, 8, this.length)
          return ieee754.read(this, offset, false, 52, 8)
        }

        function checkInt(buf, value, offset, ext, max, min) {
          if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
          if (value > max || value < min) throw new RangeError('value is out of bounds')
          if (offset + ext > buf.length) throw new RangeError('index out of range')
        }

        Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
          value = +value
          offset = offset | 0
          byteLength = byteLength | 0
          if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

          var mul = 1
          var i = 0
          this[offset] = value & 0xFF
          while (++i < byteLength && (mul *= 0x100)) {
            this[offset + i] = (value / mul) & 0xFF
          }

          return offset + byteLength
        }

        Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
          value = +value
          offset = offset | 0
          byteLength = byteLength | 0
          if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

          var i = byteLength - 1
          var mul = 1
          this[offset + i] = value & 0xFF
          while (--i >= 0 && (mul *= 0x100)) {
            this[offset + i] = (value / mul) & 0xFF
          }

          return offset + byteLength
        }

        Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
          if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
          this[offset] = (value & 0xff)
          return offset + 1
        }

        function objectWriteUInt16(buf, value, offset, littleEndian) {
          if (value < 0) value = 0xffff + value + 1
          for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
            buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
              (littleEndian ? i : 1 - i) * 8
          }
        }

        Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value & 0xff)
            this[offset + 1] = (value >>> 8)
          } else {
            objectWriteUInt16(this, value, offset, true)
          }
          return offset + 2
        }

        Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value >>> 8)
            this[offset + 1] = (value & 0xff)
          } else {
            objectWriteUInt16(this, value, offset, false)
          }
          return offset + 2
        }

        function objectWriteUInt32(buf, value, offset, littleEndian) {
          if (value < 0) value = 0xffffffff + value + 1
          for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
            buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
          }
        }

        Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset + 3] = (value >>> 24)
            this[offset + 2] = (value >>> 16)
            this[offset + 1] = (value >>> 8)
            this[offset] = (value & 0xff)
          } else {
            objectWriteUInt32(this, value, offset, true)
          }
          return offset + 4
        }

        Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value >>> 24)
            this[offset + 1] = (value >>> 16)
            this[offset + 2] = (value >>> 8)
            this[offset + 3] = (value & 0xff)
          } else {
            objectWriteUInt32(this, value, offset, false)
          }
          return offset + 4
        }

        Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) {
            var limit = Math.pow(2, 8 * byteLength - 1)

            checkInt(this, value, offset, byteLength, limit - 1, -limit)
          }

          var i = 0
          var mul = 1
          var sub = value < 0 ? 1 : 0
          this[offset] = value & 0xFF
          while (++i < byteLength && (mul *= 0x100)) {
            this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
          }

          return offset + byteLength
        }

        Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) {
            var limit = Math.pow(2, 8 * byteLength - 1)

            checkInt(this, value, offset, byteLength, limit - 1, -limit)
          }

          var i = byteLength - 1
          var mul = 1
          var sub = value < 0 ? 1 : 0
          this[offset + i] = value & 0xFF
          while (--i >= 0 && (mul *= 0x100)) {
            this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
          }

          return offset + byteLength
        }

        Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
          if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
          if (value < 0) value = 0xff + value + 1
          this[offset] = (value & 0xff)
          return offset + 1
        }

        Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value & 0xff)
            this[offset + 1] = (value >>> 8)
          } else {
            objectWriteUInt16(this, value, offset, true)
          }
          return offset + 2
        }

        Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value >>> 8)
            this[offset + 1] = (value & 0xff)
          } else {
            objectWriteUInt16(this, value, offset, false)
          }
          return offset + 2
        }

        Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value & 0xff)
            this[offset + 1] = (value >>> 8)
            this[offset + 2] = (value >>> 16)
            this[offset + 3] = (value >>> 24)
          } else {
            objectWriteUInt32(this, value, offset, true)
          }
          return offset + 4
        }

        Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
          value = +value
          offset = offset | 0
          if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
          if (value < 0) value = 0xffffffff + value + 1
          if (Buffer.TYPED_ARRAY_SUPPORT) {
            this[offset] = (value >>> 24)
            this[offset + 1] = (value >>> 16)
            this[offset + 2] = (value >>> 8)
            this[offset + 3] = (value & 0xff)
          } else {
            objectWriteUInt32(this, value, offset, false)
          }
          return offset + 4
        }

        function checkIEEE754(buf, value, offset, ext, max, min) {
          if (value > max || value < min) throw new RangeError('value is out of bounds')
          if (offset + ext > buf.length) throw new RangeError('index out of range')
          if (offset < 0) throw new RangeError('index out of range')
        }

        function writeFloat(buf, value, offset, littleEndian, noAssert) {
          if (!noAssert) {
            checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
          }
          ieee754.write(buf, value, offset, littleEndian, 23, 4)
          return offset + 4
        }

        Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
          return writeFloat(this, value, offset, true, noAssert)
        }

        Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
          return writeFloat(this, value, offset, false, noAssert)
        }

        function writeDouble(buf, value, offset, littleEndian, noAssert) {
          if (!noAssert) {
            checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
          }
          ieee754.write(buf, value, offset, littleEndian, 52, 8)
          return offset + 8
        }

        Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
          return writeDouble(this, value, offset, true, noAssert)
        }

        Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
          return writeDouble(this, value, offset, false, noAssert)
        }

        // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
        Buffer.prototype.copy = function copy(target, targetStart, start, end) {
          if (!start) start = 0
          if (!end && end !== 0) end = this.length
          if (targetStart >= target.length) targetStart = target.length
          if (!targetStart) targetStart = 0
          if (end > 0 && end < start) end = start

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
          if (end > this.length) end = this.length
          if (target.length - targetStart < end - start) {
            end = target.length - targetStart + start
          }

          var len = end - start
          var i

          if (this === target && start < targetStart && targetStart < end) {
            // descending copy from end
            for (i = len - 1; i >= 0; i--) {
              target[i + targetStart] = this[i + start]
            }
          } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
            // ascending copy from start
            for (i = 0; i < len; i++) {
              target[i + targetStart] = this[i + start]
            }
          } else {
            target._set(this.subarray(start, start + len), targetStart)
          }

          return len
        }

        // fill(value, start=0, end=buffer.length)
        Buffer.prototype.fill = function fill(value, start, end) {
          if (!value) value = 0
          if (!start) start = 0
          if (!end) end = this.length

          if (end < start) throw new RangeError('end < start')

          // Fill 0 bytes; we're done
          if (end === start) return
          if (this.length === 0) return

          if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
          if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

          var i
          if (typeof value === 'number') {
            for (i = start; i < end; i++) {
              this[i] = value
            }
          } else {
            var bytes = utf8ToBytes(value.toString())
            var len = bytes.length
            for (i = start; i < end; i++) {
              this[i] = bytes[i % len]
            }
          }

          return this
        }

        /**
         * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
         * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
         */
        Buffer.prototype.toArrayBuffer = function toArrayBuffer() {
          if (typeof Uint8Array !== 'undefined') {
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              return (new Buffer(this)).buffer
            } else {
              var buf = new Uint8Array(this.length)
              for (var i = 0, len = buf.length; i < len; i += 1) {
                buf[i] = this[i]
              }
              return buf.buffer
            }
          } else {
            throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
          }
        }

        // HELPER FUNCTIONS
        // ================

        var BP = Buffer.prototype

        /**
         * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
         */
        Buffer._augment = function _augment(arr) {
          arr.constructor = Buffer
          arr._isBuffer = true

          // save reference to original Uint8Array set method before overwriting
          arr._set = arr.set

          // deprecated
          arr.get = BP.get
          arr.set = BP.set

          arr.write = BP.write
          arr.toString = BP.toString
          arr.toLocaleString = BP.toString
          arr.toJSON = BP.toJSON
          arr.equals = BP.equals
          arr.compare = BP.compare
          arr.indexOf = BP.indexOf
          arr.copy = BP.copy
          arr.slice = BP.slice
          arr.readUIntLE = BP.readUIntLE
          arr.readUIntBE = BP.readUIntBE
          arr.readUInt8 = BP.readUInt8
          arr.readUInt16LE = BP.readUInt16LE
          arr.readUInt16BE = BP.readUInt16BE
          arr.readUInt32LE = BP.readUInt32LE
          arr.readUInt32BE = BP.readUInt32BE
          arr.readIntLE = BP.readIntLE
          arr.readIntBE = BP.readIntBE
          arr.readInt8 = BP.readInt8
          arr.readInt16LE = BP.readInt16LE
          arr.readInt16BE = BP.readInt16BE
          arr.readInt32LE = BP.readInt32LE
          arr.readInt32BE = BP.readInt32BE
          arr.readFloatLE = BP.readFloatLE
          arr.readFloatBE = BP.readFloatBE
          arr.readDoubleLE = BP.readDoubleLE
          arr.readDoubleBE = BP.readDoubleBE
          arr.writeUInt8 = BP.writeUInt8
          arr.writeUIntLE = BP.writeUIntLE
          arr.writeUIntBE = BP.writeUIntBE
          arr.writeUInt16LE = BP.writeUInt16LE
          arr.writeUInt16BE = BP.writeUInt16BE
          arr.writeUInt32LE = BP.writeUInt32LE
          arr.writeUInt32BE = BP.writeUInt32BE
          arr.writeIntLE = BP.writeIntLE
          arr.writeIntBE = BP.writeIntBE
          arr.writeInt8 = BP.writeInt8
          arr.writeInt16LE = BP.writeInt16LE
          arr.writeInt16BE = BP.writeInt16BE
          arr.writeInt32LE = BP.writeInt32LE
          arr.writeInt32BE = BP.writeInt32BE
          arr.writeFloatLE = BP.writeFloatLE
          arr.writeFloatBE = BP.writeFloatBE
          arr.writeDoubleLE = BP.writeDoubleLE
          arr.writeDoubleBE = BP.writeDoubleBE
          arr.fill = BP.fill
          arr.inspect = BP.inspect
          arr.toArrayBuffer = BP.toArrayBuffer

          return arr
        }

        var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

        function base64clean(str) {
          // Node strips out invalid characters like \n and \t from the string, base64-js does not
          str = stringtrim(str).replace(INVALID_BASE64_RE, '')
          // Node converts strings with length < 2 to ''
          if (str.length < 2) return ''
          // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
          while (str.length % 4 !== 0) {
            str = str + '='
          }
          return str
        }

        function stringtrim(str) {
          if (str.trim) return str.trim()
          return str.replace(/^\s+|\s+$/g, '')
        }

        function toHex(n) {
          if (n < 16) return '0' + n.toString(16)
          return n.toString(16)
        }

        function utf8ToBytes(string, units) {
          units = units || Infinity
          var codePoint
          var length = string.length
          var leadSurrogate = null
          var bytes = []

          for (var i = 0; i < length; i++) {
            codePoint = string.charCodeAt(i)

            // is surrogate component
            if (codePoint > 0xD7FF && codePoint < 0xE000) {
              // last char was a lead
              if (!leadSurrogate) {
                // no lead yet
                if (codePoint > 0xDBFF) {
                  // unexpected trail
                  if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                  continue
                } else if (i + 1 === length) {
                  // unpaired lead
                  if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                  continue
                }

                // valid lead
                leadSurrogate = codePoint

                continue
              }

              // 2 leads in a row
              if (codePoint < 0xDC00) {
                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                leadSurrogate = codePoint
                continue
              }

              // valid surrogate pair
              codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
            } else if (leadSurrogate) {
              // valid bmp char, but last char was a lead
              if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
            }

            leadSurrogate = null

            // encode utf8
            if (codePoint < 0x80) {
              if ((units -= 1) < 0) break
              bytes.push(codePoint)
            } else if (codePoint < 0x800) {
              if ((units -= 2) < 0) break
              bytes.push(
                codePoint >> 0x6 | 0xC0,
                codePoint & 0x3F | 0x80
              )
            } else if (codePoint < 0x10000) {
              if ((units -= 3) < 0) break
              bytes.push(
                codePoint >> 0xC | 0xE0,
                codePoint >> 0x6 & 0x3F | 0x80,
                codePoint & 0x3F | 0x80
              )
            } else if (codePoint < 0x110000) {
              if ((units -= 4) < 0) break
              bytes.push(
                codePoint >> 0x12 | 0xF0,
                codePoint >> 0xC & 0x3F | 0x80,
                codePoint >> 0x6 & 0x3F | 0x80,
                codePoint & 0x3F | 0x80
              )
            } else {
              throw new Error('Invalid code point')
            }
          }

          return bytes
        }

        function asciiToBytes(str) {
          var byteArray = []
          for (var i = 0; i < str.length; i++) {
            // Node's code seems to be doing this and not & 0x7F..
            byteArray.push(str.charCodeAt(i) & 0xFF)
          }
          return byteArray
        }

        function utf16leToBytes(str, units) {
          var c, hi, lo
          var byteArray = []
          for (var i = 0; i < str.length; i++) {
            if ((units -= 2) < 0) break

            c = str.charCodeAt(i)
            hi = c >> 8
            lo = c % 256
            byteArray.push(lo)
            byteArray.push(hi)
          }

          return byteArray
        }

        function base64ToBytes(str) {
          return base64.toByteArray(base64clean(str))
        }

        function blitBuffer(src, dst, offset, length) {
          for (var i = 0; i < length; i++) {
            if ((i + offset >= dst.length) || (i >= src.length)) break
            dst[i + offset] = src[i]
          }
          return i
        }

      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, {
      "base64-js": 13,
      "ieee754": 16,
      "isarray": 15
    }],
    15: [function (require, module, exports) {
      var toString = {}.toString;

      module.exports = Array.isArray || function (arr) {
        return toString.call(arr) == '[object Array]';
      };

    }, {}],
    16: [function (require, module, exports) {
      exports.read = function (buffer, offset, isLE, mLen, nBytes) {
        var e, m
        var eLen = (nBytes * 8) - mLen - 1
        var eMax = (1 << eLen) - 1
        var eBias = eMax >> 1
        var nBits = -7
        var i = isLE ? (nBytes - 1) : 0
        var d = isLE ? -1 : 1
        var s = buffer[offset + i]

        i += d

        e = s & ((1 << (-nBits)) - 1)
        s >>= (-nBits)
        nBits += eLen
        for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

        m = e & ((1 << (-nBits)) - 1)
        e >>= (-nBits)
        nBits += mLen
        for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

        if (e === 0) {
          e = 1 - eBias
        } else if (e === eMax) {
          return m ? NaN : ((s ? -1 : 1) * Infinity)
        } else {
          m = m + Math.pow(2, mLen)
          e = e - eBias
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
      }

      exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c
        var eLen = (nBytes * 8) - mLen - 1
        var eMax = (1 << eLen) - 1
        var eBias = eMax >> 1
        var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
        var i = isLE ? 0 : (nBytes - 1)
        var d = isLE ? 1 : -1
        var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

        value = Math.abs(value)

        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0
          e = eMax
        } else {
          e = Math.floor(Math.log(value) / Math.LN2)
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--
            c *= 2
          }
          if (e + eBias >= 1) {
            value += rt / c
          } else {
            value += rt * Math.pow(2, 1 - eBias)
          }
          if (value * c >= 2) {
            e++
            c /= 2
          }

          if (e + eBias >= eMax) {
            m = 0
            e = eMax
          } else if (e + eBias >= 1) {
            m = ((value * c) - 1) * Math.pow(2, mLen)
            e = e + eBias
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
            e = 0
          }
        }

        for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

        e = (e << mLen) | m
        eLen += mLen
        for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

        buffer[offset + i - d] |= s * 128
      }

    }, {}],
    17: [function (require, module, exports) {
      (function (global) {
        'use strict';
        var Mutation = global.MutationObserver || global.WebKitMutationObserver;

        var scheduleDrain;

        {
          if (Mutation) {
            var called = 0;
            var observer = new Mutation(nextTick);
            var element = global.document.createTextNode('');
            observer.observe(element, {
              characterData: true
            });
            scheduleDrain = function () {
              element.data = (called = ++called % 2);
            };
          } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
            var channel = new global.MessageChannel();
            channel.port1.onmessage = nextTick;
            scheduleDrain = function () {
              channel.port2.postMessage(0);
            };
          } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
            scheduleDrain = function () {

              // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
              // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
              var scriptEl = global.document.createElement('script');
              scriptEl.onreadystatechange = function () {
                nextTick();

                scriptEl.onreadystatechange = null;
                scriptEl.parentNode.removeChild(scriptEl);
                scriptEl = null;
              };
              global.document.documentElement.appendChild(scriptEl);
            };
          } else {
            scheduleDrain = function () {
              setTimeout(nextTick, 0);
            };
          }
        }

        var draining;
        var queue = [];
        //named nextTick for less confusing stack traces
        function nextTick() {
          draining = true;
          var i, oldQueue;
          var len = queue.length;
          while (len) {
            oldQueue = queue;
            queue = [];
            i = -1;
            while (++i < len) {
              oldQueue[i]();
            }
            len = queue.length;
          }
          draining = false;
        }

        module.exports = immediate;

        function immediate(task) {
          if (queue.push(task) === 1 && !draining) {
            scheduleDrain();
          }
        }

      }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, {}],
    18: [function (require, module, exports) {
      // private property
      var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";


      // public method for encoding
      exports.encode = function (input, utf8) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        while (i < input.length) {

          chr1 = input.charCodeAt(i++);
          chr2 = input.charCodeAt(i++);
          chr3 = input.charCodeAt(i++);

          enc1 = chr1 >> 2;
          enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
          enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
          enc4 = chr3 & 63;

          if (isNaN(chr2)) {
            enc3 = enc4 = 64;
          } else if (isNaN(chr3)) {
            enc4 = 64;
          }

          output = output + _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4);

        }

        return output;
      };

      // public method for decoding
      exports.decode = function (input, utf8) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {

          enc1 = _keyStr.indexOf(input.charAt(i++));
          enc2 = _keyStr.indexOf(input.charAt(i++));
          enc3 = _keyStr.indexOf(input.charAt(i++));
          enc4 = _keyStr.indexOf(input.charAt(i++));

          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;

          output = output + String.fromCharCode(chr1);

          if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
          }
          if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
          }

        }

        return output;

      };

    }, {}],
    19: [function (require, module, exports) {
      function CompressedObject() {
        this.compressedSize = 0;
        this.uncompressedSize = 0;
        this.crc32 = 0;
        this.compressionMethod = null;
        this.compressedContent = null;
      }

      CompressedObject.prototype = {
        /**
         * Return the decompressed content in an unspecified format.
         * The format will depend on the decompressor.
         * @return {Object} the decompressed content.
         */
        getContent: function () {
          return null; // see implementation
        },
        /**
         * Return the compressed content in an unspecified format.
         * The format will depend on the compressed conten source.
         * @return {Object} the compressed content.
         */
        getCompressedContent: function () {
          return null; // see implementation
        }
      };
      module.exports = CompressedObject;

    }, {}],
    20: [function (require, module, exports) {
      exports.STORE = {
        magic: "\x00\x00",
        compress: function (content) {
          return content; // no compression
        },
        uncompress: function (content) {
          return content; // no compression
        },
        compressInputType: null,
        uncompressInputType: null
      };
      exports.DEFLATE = require('./flate');

    }, {
      "./flate": 24
    }],
    21: [function (require, module, exports) {
      var utils = require('./utils');

      function DataReader(data) {
        this.data = null; // type : see implementation
        this.length = 0;
        this.index = 0;
      }
      DataReader.prototype = {
        /**
         * Check that the offset will not go too far.
         * @param {string} offset the additional offset to check.
         * @throws {Error} an Error if the offset is out of bounds.
         */
        checkOffset: function (offset) {
          this.checkIndex(this.index + offset);
        },
        /**
         * Check that the specifed index will not be too far.
         * @param {string} newIndex the index to check.
         * @throws {Error} an Error if the index is out of bounds.
         */
        checkIndex: function (newIndex) {
          if (this.length < newIndex || newIndex < 0) {
            throw new Error("End of data reached (data length = " + this.length + ", asked index = " + (newIndex) + "). Corrupted zip ?");
          }
        },
        /**
         * Change the index.
         * @param {number} newIndex The new index.
         * @throws {Error} if the new index is out of the data.
         */
        setIndex: function (newIndex) {
          this.checkIndex(newIndex);
          this.index = newIndex;
        },
        /**
         * Skip the next n bytes.
         * @param {number} n the number of bytes to skip.
         * @throws {Error} if the new index is out of the data.
         */
        skip: function (n) {
          this.setIndex(this.index + n);
        },
        /**
         * Get the byte at the specified index.
         * @param {number} i the index to use.
         * @return {number} a byte.
         */
        byteAt: function (i) {
          // see implementations
        },
        /**
         * Get the next number with a given byte size.
         * @param {number} size the number of bytes to read.
         * @return {number} the corresponding number.
         */
        readInt: function (size) {
          var result = 0,
            i;
          this.checkOffset(size);
          for (i = this.index + size - 1; i >= this.index; i--) {
            result = (result << 8) + this.byteAt(i);
          }
          this.index += size;
          return result;
        },
        /**
         * Get the next string with a given byte size.
         * @param {number} size the number of bytes to read.
         * @return {string} the corresponding string.
         */
        readString: function (size) {
          return utils.transformTo("string", this.readData(size));
        },
        /**
         * Get raw data without conversion, <size> bytes.
         * @param {number} size the number of bytes to read.
         * @return {Object} the raw data, implementation specific.
         */
        readData: function (size) {
          // see implementations
        },
        /**
         * Find the last occurence of a zip signature (4 bytes).
         * @param {string} sig the signature to find.
         * @return {number} the index of the last occurence, -1 if not found.
         */
        lastIndexOfSignature: function (sig) {
          // see implementations
        },
        /**
         * Get the next date.
         * @return {Date} the date.
         */
        readDate: function () {
          var dostime = this.readInt(4);
          return new Date(
            ((dostime >> 25) & 0x7f) + 1980, // year
            ((dostime >> 21) & 0x0f) - 1, // month
            (dostime >> 16) & 0x1f, // day
            (dostime >> 11) & 0x1f, // hour
            (dostime >> 5) & 0x3f, // minute
            (dostime & 0x1f) << 1); // second
        }
      };
      module.exports = DataReader;

    }, {
      "./utils": 34
    }],
    22: [function (require, module, exports) {
      exports.base64 = false;
      exports.binary = false;
      exports.dir = false;
      exports.date = null;
      exports.compression = null;
    }, {}],
    23: [function (require, module, exports) {
      var context = {};
      (function () {

        // https://github.com/imaya/zlib.js
        // tag 0.1.6
        // file bin/deflate.min.js

        /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */
        (function () {
          'use strict';
          var n = void 0,
            u = !0,
            aa = this;

          function ba(e, d) {
            var c = e.split("."),
              f = aa;
            !(c[0] in f) && f.execScript && f.execScript("var " + c[0]);
            for (var a; c.length && (a = c.shift());) !c.length && d !== n ? f[a] = d : f = f[a] ? f[a] : f[a] = {}
          };
          var C = "undefined" !== typeof Uint8Array && "undefined" !== typeof Uint16Array && "undefined" !== typeof Uint32Array;

          function K(e, d) {
            this.index = "number" === typeof d ? d : 0;
            this.d = 0;
            this.buffer = e instanceof(C ? Uint8Array : Array) ? e : new(C ? Uint8Array : Array)(32768);
            if (2 * this.buffer.length <= this.index) throw Error("invalid index");
            this.buffer.length <= this.index && ca(this)
          }

          function ca(e) {
            var d = e.buffer,
              c, f = d.length,
              a = new(C ? Uint8Array : Array)(f << 1);
            if (C) a.set(d);
            else
              for (c = 0; c < f; ++c) a[c] = d[c];
            return e.buffer = a
          }
          K.prototype.a = function (e, d, c) {
            var f = this.buffer,
              a = this.index,
              b = this.d,
              k = f[a],
              m;
            c && 1 < d && (e = 8 < d ? (L[e & 255] << 24 | L[e >>> 8 & 255] << 16 | L[e >>> 16 & 255] << 8 | L[e >>> 24 & 255]) >> 32 - d : L[e] >> 8 - d);
            if (8 > d + b) k = k << d | e, b += d;
            else
              for (m = 0; m < d; ++m) k = k << 1 | e >> d - m - 1 & 1, 8 === ++b && (b = 0, f[a++] = L[k], k = 0, a === f.length && (f = ca(this)));
            f[a] = k;
            this.buffer = f;
            this.d = b;
            this.index = a
          };
          K.prototype.finish = function () {
            var e = this.buffer,
              d = this.index,
              c;
            0 < this.d && (e[d] <<= 8 - this.d, e[d] = L[e[d]], d++);
            C ? c = e.subarray(0, d) : (e.length = d, c = e);
            return c
          };
          var ga = new(C ? Uint8Array : Array)(256),
            M;
          for (M = 0; 256 > M; ++M) {
            for (var R = M, S = R, ha = 7, R = R >>> 1; R; R >>>= 1) S <<= 1, S |= R & 1, --ha;
            ga[M] = (S << ha & 255) >>> 0
          }
          var L = ga;

          function ja(e) {
            this.buffer = new(C ? Uint16Array : Array)(2 * e);
            this.length = 0
          }
          ja.prototype.getParent = function (e) {
            return 2 * ((e - 2) / 4 | 0)
          };
          ja.prototype.push = function (e, d) {
            var c, f, a = this.buffer,
              b;
            c = this.length;
            a[this.length++] = d;
            for (a[this.length++] = e; 0 < c;)
              if (f = this.getParent(c), a[c] > a[f]) b = a[c], a[c] = a[f], a[f] = b, b = a[c + 1], a[c + 1] = a[f + 1], a[f + 1] = b, c = f;
              else break;
            return this.length
          };
          ja.prototype.pop = function () {
            var e, d, c = this.buffer,
              f, a, b;
            d = c[0];
            e = c[1];
            this.length -= 2;
            c[0] = c[this.length];
            c[1] = c[this.length + 1];
            for (b = 0;;) {
              a = 2 * b + 2;
              if (a >= this.length) break;
              a + 2 < this.length && c[a + 2] > c[a] && (a += 2);
              if (c[a] > c[b]) f = c[b], c[b] = c[a], c[a] = f, f = c[b + 1], c[b + 1] = c[a + 1], c[a + 1] = f;
              else break;
              b = a
            }
            return {
              index: e,
              value: d,
              length: this.length
            }
          };

          function ka(e, d) {
            this.e = ma;
            this.f = 0;
            this.input = C && e instanceof Array ? new Uint8Array(e) : e;
            this.c = 0;
            d && (d.lazy && (this.f = d.lazy), "number" === typeof d.compressionType && (this.e = d.compressionType), d.outputBuffer && (this.b = C && d.outputBuffer instanceof Array ? new Uint8Array(d.outputBuffer) : d.outputBuffer), "number" === typeof d.outputIndex && (this.c = d.outputIndex));
            this.b || (this.b = new(C ? Uint8Array : Array)(32768))
          }
          var ma = 2,
            T = [],
            U;
          for (U = 0; 288 > U; U++) switch (u) {
            case 143 >= U:
              T.push([U + 48, 8]);
              break;
            case 255 >= U:
              T.push([U - 144 + 400, 9]);
              break;
            case 279 >= U:
              T.push([U - 256 + 0, 7]);
              break;
            case 287 >= U:
              T.push([U - 280 + 192, 8]);
              break;
            default:
              throw "invalid literal: " + U;
          }
          ka.prototype.h = function () {
            var e, d, c, f, a = this.input;
            switch (this.e) {
              case 0:
                c = 0;
                for (f = a.length; c < f;) {
                  d = C ? a.subarray(c, c + 65535) : a.slice(c, c + 65535);
                  c += d.length;
                  var b = d,
                    k = c === f,
                    m = n,
                    g = n,
                    p = n,
                    v = n,
                    x = n,
                    l = this.b,
                    h = this.c;
                  if (C) {
                    for (l = new Uint8Array(this.b.buffer); l.length <= h + b.length + 5;) l = new Uint8Array(l.length << 1);
                    l.set(this.b)
                  }
                  m = k ? 1 : 0;
                  l[h++] = m | 0;
                  g = b.length;
                  p = ~g + 65536 & 65535;
                  l[h++] = g & 255;
                  l[h++] = g >>> 8 & 255;
                  l[h++] = p & 255;
                  l[h++] = p >>> 8 & 255;
                  if (C) l.set(b, h), h += b.length, l = l.subarray(0, h);
                  else {
                    v = 0;
                    for (x = b.length; v < x; ++v) l[h++] = b[v];
                    l.length = h
                  }
                  this.c = h;
                  this.b = l
                }
                break;
              case 1:
                var q = new K(C ? new Uint8Array(this.b.buffer) : this.b, this.c);
                q.a(1, 1, u);
                q.a(1, 2, u);
                var t = na(this, a),
                  w, da, z;
                w = 0;
                for (da = t.length; w < da; w++)
                  if (z = t[w], K.prototype.a.apply(q, T[z]), 256 < z) q.a(t[++w], t[++w], u), q.a(t[++w], 5), q.a(t[++w], t[++w], u);
                  else if (256 === z) break;
                this.b = q.finish();
                this.c = this.b.length;
                break;
              case ma:
                var B = new K(C ? new Uint8Array(this.b.buffer) : this.b, this.c),
                  ra, J, N, O, P, Ia = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
                  W, sa, X, ta, ea, ia = Array(19),
                  ua, Q, fa, y, va;
                ra = ma;
                B.a(1, 1, u);
                B.a(ra, 2, u);
                J = na(this, a);
                W = oa(this.j, 15);
                sa = pa(W);
                X = oa(this.i, 7);
                ta = pa(X);
                for (N = 286; 257 < N && 0 === W[N - 1]; N--);
                for (O = 30; 1 < O && 0 === X[O - 1]; O--);
                var wa = N,
                  xa = O,
                  F = new(C ? Uint32Array : Array)(wa + xa),
                  r, G, s, Y, E = new(C ? Uint32Array : Array)(316),
                  D, A, H = new(C ? Uint8Array : Array)(19);
                for (r = G = 0; r < wa; r++) F[G++] = W[r];
                for (r = 0; r < xa; r++) F[G++] = X[r];
                if (!C) {
                  r = 0;
                  for (Y = H.length; r < Y; ++r) H[r] = 0
                }
                r = D = 0;
                for (Y = F.length; r < Y; r += G) {
                  for (G = 1; r + G < Y && F[r + G] === F[r]; ++G);
                  s = G;
                  if (0 === F[r])
                    if (3 > s)
                      for (; 0 < s--;) E[D++] = 0,
                        H[0]++;
                    else
                      for (; 0 < s;) A = 138 > s ? s : 138, A > s - 3 && A < s && (A = s - 3), 10 >= A ? (E[D++] = 17, E[D++] = A - 3, H[17]++) : (E[D++] = 18, E[D++] = A - 11, H[18]++), s -= A;
                  else if (E[D++] = F[r], H[F[r]]++, s--, 3 > s)
                    for (; 0 < s--;) E[D++] = F[r], H[F[r]]++;
                  else
                    for (; 0 < s;) A = 6 > s ? s : 6, A > s - 3 && A < s && (A = s - 3), E[D++] = 16, E[D++] = A - 3, H[16]++, s -= A
                }
                e = C ? E.subarray(0, D) : E.slice(0, D);
                ea = oa(H, 7);
                for (y = 0; 19 > y; y++) ia[y] = ea[Ia[y]];
                for (P = 19; 4 < P && 0 === ia[P - 1]; P--);
                ua = pa(ea);
                B.a(N - 257, 5, u);
                B.a(O - 1, 5, u);
                B.a(P - 4, 4, u);
                for (y = 0; y < P; y++) B.a(ia[y], 3, u);
                y = 0;
                for (va = e.length; y < va; y++)
                  if (Q = e[y], B.a(ua[Q], ea[Q], u), 16 <= Q) {
                    y++;
                    switch (Q) {
                      case 16:
                        fa = 2;
                        break;
                      case 17:
                        fa = 3;
                        break;
                      case 18:
                        fa = 7;
                        break;
                      default:
                        throw "invalid code: " + Q;
                    }
                    B.a(e[y], fa, u)
                  }
                var ya = [sa, W],
                  za = [ta, X],
                  I, Aa, Z, la, Ba, Ca, Da, Ea;
                Ba = ya[0];
                Ca = ya[1];
                Da = za[0];
                Ea = za[1];
                I = 0;
                for (Aa = J.length; I < Aa; ++I)
                  if (Z = J[I], B.a(Ba[Z], Ca[Z], u), 256 < Z) B.a(J[++I], J[++I], u), la = J[++I], B.a(Da[la], Ea[la], u), B.a(J[++I], J[++I], u);
                  else if (256 === Z) break;
                this.b = B.finish();
                this.c = this.b.length;
                break;
              default:
                throw "invalid compression type";
            }
            return this.b
          };

          function qa(e, d) {
            this.length = e;
            this.g = d
          }
          var Fa = function () {
              function e(a) {
                switch (u) {
                  case 3 === a:
                    return [257, a - 3, 0];
                  case 4 === a:
                    return [258, a - 4, 0];
                  case 5 === a:
                    return [259, a - 5, 0];
                  case 6 === a:
                    return [260, a - 6, 0];
                  case 7 === a:
                    return [261, a - 7, 0];
                  case 8 === a:
                    return [262, a - 8, 0];
                  case 9 === a:
                    return [263, a - 9, 0];
                  case 10 === a:
                    return [264, a - 10, 0];
                  case 12 >= a:
                    return [265, a - 11, 1];
                  case 14 >= a:
                    return [266, a - 13, 1];
                  case 16 >= a:
                    return [267, a - 15, 1];
                  case 18 >= a:
                    return [268, a - 17, 1];
                  case 22 >= a:
                    return [269, a - 19, 2];
                  case 26 >= a:
                    return [270, a - 23, 2];
                  case 30 >= a:
                    return [271, a - 27, 2];
                  case 34 >= a:
                    return [272,
                      a - 31, 2
                    ];
                  case 42 >= a:
                    return [273, a - 35, 3];
                  case 50 >= a:
                    return [274, a - 43, 3];
                  case 58 >= a:
                    return [275, a - 51, 3];
                  case 66 >= a:
                    return [276, a - 59, 3];
                  case 82 >= a:
                    return [277, a - 67, 4];
                  case 98 >= a:
                    return [278, a - 83, 4];
                  case 114 >= a:
                    return [279, a - 99, 4];
                  case 130 >= a:
                    return [280, a - 115, 4];
                  case 162 >= a:
                    return [281, a - 131, 5];
                  case 194 >= a:
                    return [282, a - 163, 5];
                  case 226 >= a:
                    return [283, a - 195, 5];
                  case 257 >= a:
                    return [284, a - 227, 5];
                  case 258 === a:
                    return [285, a - 258, 0];
                  default:
                    throw "invalid length: " + a;
                }
              }
              var d = [],
                c, f;
              for (c = 3; 258 >= c; c++) f = e(c), d[c] = f[2] << 24 | f[1] << 16 | f[0];
              return d
            }(),
            Ga = C ? new Uint32Array(Fa) : Fa;

          function na(e, d) {
            function c(a, c) {
              var b = a.g,
                d = [],
                f = 0,
                e;
              e = Ga[a.length];
              d[f++] = e & 65535;
              d[f++] = e >> 16 & 255;
              d[f++] = e >> 24;
              var g;
              switch (u) {
                case 1 === b:
                  g = [0, b - 1, 0];
                  break;
                case 2 === b:
                  g = [1, b - 2, 0];
                  break;
                case 3 === b:
                  g = [2, b - 3, 0];
                  break;
                case 4 === b:
                  g = [3, b - 4, 0];
                  break;
                case 6 >= b:
                  g = [4, b - 5, 1];
                  break;
                case 8 >= b:
                  g = [5, b - 7, 1];
                  break;
                case 12 >= b:
                  g = [6, b - 9, 2];
                  break;
                case 16 >= b:
                  g = [7, b - 13, 2];
                  break;
                case 24 >= b:
                  g = [8, b - 17, 3];
                  break;
                case 32 >= b:
                  g = [9, b - 25, 3];
                  break;
                case 48 >= b:
                  g = [10, b - 33, 4];
                  break;
                case 64 >= b:
                  g = [11, b - 49, 4];
                  break;
                case 96 >= b:
                  g = [12, b - 65, 5];
                  break;
                case 128 >= b:
                  g = [13, b - 97, 5];
                  break;
                case 192 >= b:
                  g = [14, b - 129, 6];
                  break;
                case 256 >= b:
                  g = [15, b - 193, 6];
                  break;
                case 384 >= b:
                  g = [16, b - 257, 7];
                  break;
                case 512 >= b:
                  g = [17, b - 385, 7];
                  break;
                case 768 >= b:
                  g = [18, b - 513, 8];
                  break;
                case 1024 >= b:
                  g = [19, b - 769, 8];
                  break;
                case 1536 >= b:
                  g = [20, b - 1025, 9];
                  break;
                case 2048 >= b:
                  g = [21, b - 1537, 9];
                  break;
                case 3072 >= b:
                  g = [22, b - 2049, 10];
                  break;
                case 4096 >= b:
                  g = [23, b - 3073, 10];
                  break;
                case 6144 >= b:
                  g = [24, b - 4097, 11];
                  break;
                case 8192 >= b:
                  g = [25, b - 6145, 11];
                  break;
                case 12288 >= b:
                  g = [26, b - 8193, 12];
                  break;
                case 16384 >= b:
                  g = [27, b - 12289, 12];
                  break;
                case 24576 >= b:
                  g = [28, b - 16385, 13];
                  break;
                case 32768 >= b:
                  g = [29, b - 24577, 13];
                  break;
                default:
                  throw "invalid distance";
              }
              e = g;
              d[f++] = e[0];
              d[f++] = e[1];
              d[f++] = e[2];
              var k, m;
              k = 0;
              for (m = d.length; k < m; ++k) l[h++] = d[k];
              t[d[0]]++;
              w[d[3]]++;
              q = a.length + c - 1;
              x = null
            }
            var f, a, b, k, m, g = {},
              p, v, x, l = C ? new Uint16Array(2 * d.length) : [],
              h = 0,
              q = 0,
              t = new(C ? Uint32Array : Array)(286),
              w = new(C ? Uint32Array : Array)(30),
              da = e.f,
              z;
            if (!C) {
              for (b = 0; 285 >= b;) t[b++] = 0;
              for (b = 0; 29 >= b;) w[b++] = 0
            }
            t[256] = 1;
            f = 0;
            for (a = d.length; f < a; ++f) {
              b = m = 0;
              for (k = 3; b < k && f + b !== a; ++b) m = m << 8 | d[f + b];
              g[m] === n && (g[m] = []);
              p = g[m];
              if (!(0 < q--)) {
                for (; 0 < p.length && 32768 < f - p[0];) p.shift();
                if (f + 3 >= a) {
                  x && c(x, -1);
                  b = 0;
                  for (k = a - f; b < k; ++b) z = d[f + b], l[h++] = z, ++t[z];
                  break
                }
                0 < p.length ? (v = Ha(d, f, p), x ? x.length < v.length ? (z = d[f - 1], l[h++] = z, ++t[z], c(v, 0)) : c(x, -1) : v.length < da ? x = v : c(v, 0)) : x ? c(x, -1) : (z = d[f], l[h++] = z, ++t[z])
              }
              p.push(f)
            }
            l[h++] = 256;
            t[256]++;
            e.j = t;
            e.i = w;
            return C ? l.subarray(0, h) : l
          }

          function Ha(e, d, c) {
            var f, a, b = 0,
              k, m, g, p, v = e.length;
            m = 0;
            p = c.length;
            a: for (; m < p; m++) {
              f = c[p - m - 1];
              k = 3;
              if (3 < b) {
                for (g = b; 3 < g; g--)
                  if (e[f + g - 1] !== e[d + g - 1]) continue a;
                k = b
              }
              for (; 258 > k && d + k < v && e[f + k] === e[d + k];) ++k;
              k > b && (a = f, b = k);
              if (258 === k) break
            }
            return new qa(b, d - a)
          }

          function oa(e, d) {
            var c = e.length,
              f = new ja(572),
              a = new(C ? Uint8Array : Array)(c),
              b, k, m, g, p;
            if (!C)
              for (g = 0; g < c; g++) a[g] = 0;
            for (g = 0; g < c; ++g) 0 < e[g] && f.push(g, e[g]);
            b = Array(f.length / 2);
            k = new(C ? Uint32Array : Array)(f.length / 2);
            if (1 === b.length) return a[f.pop().index] = 1, a;
            g = 0;
            for (p = f.length / 2; g < p; ++g) b[g] = f.pop(), k[g] = b[g].value;
            m = Ja(k, k.length, d);
            g = 0;
            for (p = b.length; g < p; ++g) a[b[g].index] = m[g];
            return a
          }

          function Ja(e, d, c) {
            function f(a) {
              var b = g[a][p[a]];
              b === d ? (f(a + 1), f(a + 1)) : --k[b];
              ++p[a]
            }
            var a = new(C ? Uint16Array : Array)(c),
              b = new(C ? Uint8Array : Array)(c),
              k = new(C ? Uint8Array : Array)(d),
              m = Array(c),
              g = Array(c),
              p = Array(c),
              v = (1 << c) - d,
              x = 1 << c - 1,
              l, h, q, t, w;
            a[c - 1] = d;
            for (h = 0; h < c; ++h) v < x ? b[h] = 0 : (b[h] = 1, v -= x), v <<= 1, a[c - 2 - h] = (a[c - 1 - h] / 2 | 0) + d;
            a[0] = b[0];
            m[0] = Array(a[0]);
            g[0] = Array(a[0]);
            for (h = 1; h < c; ++h) a[h] > 2 * a[h - 1] + b[h] && (a[h] = 2 * a[h - 1] + b[h]), m[h] = Array(a[h]), g[h] = Array(a[h]);
            for (l = 0; l < d; ++l) k[l] = c;
            for (q = 0; q < a[c - 1]; ++q) m[c - 1][q] = e[q], g[c - 1][q] = q;
            for (l = 0; l < c; ++l) p[l] = 0;
            1 === b[c - 1] && (--k[0], ++p[c - 1]);
            for (h = c - 2; 0 <= h; --h) {
              t = l = 0;
              w = p[h + 1];
              for (q = 0; q < a[h]; q++) t = m[h + 1][w] + m[h + 1][w + 1], t > e[l] ? (m[h][q] = t, g[h][q] = d, w += 2) : (m[h][q] = e[l], g[h][q] = l, ++l);
              p[h] = 0;
              1 === b[h] && f(h)
            }
            return k
          }

          function pa(e) {
            var d = new(C ? Uint16Array : Array)(e.length),
              c = [],
              f = [],
              a = 0,
              b, k, m, g;
            b = 0;
            for (k = e.length; b < k; b++) c[e[b]] = (c[e[b]] | 0) + 1;
            b = 1;
            for (k = 16; b <= k; b++) f[b] = a, a += c[b] | 0, a <<= 1;
            b = 0;
            for (k = e.length; b < k; b++) {
              a = f[e[b]];
              f[e[b]] += 1;
              m = d[b] = 0;
              for (g = e[b]; m < g; m++) d[b] = d[b] << 1 | a & 1, a >>>= 1
            }
            return d
          };
          ba("Zlib.RawDeflate", ka);
          ba("Zlib.RawDeflate.prototype.compress", ka.prototype.h);
          var Ka = {
              NONE: 0,
              FIXED: 1,
              DYNAMIC: ma
            },
            V, La, $, Ma;
          if (Object.keys) V = Object.keys(Ka);
          else
            for (La in V = [], $ = 0, Ka) V[$++] = La;
          $ = 0;
          for (Ma = V.length; $ < Ma; ++$) La = V[$], ba("Zlib.RawDeflate.CompressionType." + La, Ka[La]);
        }).call(this);


      }).call(context);

      module.exports = function (input) {
        var deflate = new context.Zlib.RawDeflate(input);
        return deflate.compress();
      };

    }, {}],
    24: [function (require, module, exports) {
      var USE_TYPEDARRAY = (typeof Uint8Array !== 'undefined') && (typeof Uint16Array !== 'undefined') && (typeof Uint32Array !== 'undefined');
      exports.magic = "\x08\x00";
      exports.uncompress = require('./inflate');
      exports.uncompressInputType = USE_TYPEDARRAY ? "uint8array" : "array";
      exports.compress = require('./deflate');
      exports.compressInputType = USE_TYPEDARRAY ? "uint8array" : "array";

    }, {
      "./deflate": 23,
      "./inflate": 25
    }],
    25: [function (require, module, exports) {
      var context = {};
      (function () {

        // https://github.com/imaya/zlib.js
        // tag 0.1.6
        // file bin/deflate.min.js

        /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */
        (function () {
          'use strict';
          var l = void 0,
            p = this;

          function q(c, d) {
            var a = c.split("."),
              b = p;
            !(a[0] in b) && b.execScript && b.execScript("var " + a[0]);
            for (var e; a.length && (e = a.shift());) !a.length && d !== l ? b[e] = d : b = b[e] ? b[e] : b[e] = {}
          };
          var r = "undefined" !== typeof Uint8Array && "undefined" !== typeof Uint16Array && "undefined" !== typeof Uint32Array;

          function u(c) {
            var d = c.length,
              a = 0,
              b = Number.POSITIVE_INFINITY,
              e, f, g, h, k, m, s, n, t;
            for (n = 0; n < d; ++n) c[n] > a && (a = c[n]), c[n] < b && (b = c[n]);
            e = 1 << a;
            f = new(r ? Uint32Array : Array)(e);
            g = 1;
            h = 0;
            for (k = 2; g <= a;) {
              for (n = 0; n < d; ++n)
                if (c[n] === g) {
                  m = 0;
                  s = h;
                  for (t = 0; t < g; ++t) m = m << 1 | s & 1, s >>= 1;
                  for (t = m; t < e; t += k) f[t] = g << 16 | n;
                  ++h
                }++ g;
              h <<= 1;
              k <<= 1
            }
            return [f, a, b]
          };

          function v(c, d) {
            this.g = [];
            this.h = 32768;
            this.c = this.f = this.d = this.k = 0;
            this.input = r ? new Uint8Array(c) : c;
            this.l = !1;
            this.i = w;
            this.p = !1;
            if (d || !(d = {})) d.index && (this.d = d.index), d.bufferSize && (this.h = d.bufferSize), d.bufferType && (this.i = d.bufferType), d.resize && (this.p = d.resize);
            switch (this.i) {
              case x:
                this.a = 32768;
                this.b = new(r ? Uint8Array : Array)(32768 + this.h + 258);
                break;
              case w:
                this.a = 0;
                this.b = new(r ? Uint8Array : Array)(this.h);
                this.e = this.u;
                this.m = this.r;
                this.j = this.s;
                break;
              default:
                throw Error("invalid inflate mode");
            }
          }
          var x = 0,
            w = 1;
          v.prototype.t = function () {
            for (; !this.l;) {
              var c = y(this, 3);
              c & 1 && (this.l = !0);
              c >>>= 1;
              switch (c) {
                case 0:
                  var d = this.input,
                    a = this.d,
                    b = this.b,
                    e = this.a,
                    f = l,
                    g = l,
                    h = l,
                    k = b.length,
                    m = l;
                  this.c = this.f = 0;
                  f = d[a++];
                  if (f === l) throw Error("invalid uncompressed block header: LEN (first byte)");
                  g = f;
                  f = d[a++];
                  if (f === l) throw Error("invalid uncompressed block header: LEN (second byte)");
                  g |= f << 8;
                  f = d[a++];
                  if (f === l) throw Error("invalid uncompressed block header: NLEN (first byte)");
                  h = f;
                  f = d[a++];
                  if (f === l) throw Error("invalid uncompressed block header: NLEN (second byte)");
                  h |= f << 8;
                  if (g === ~h) throw Error("invalid uncompressed block header: length verify");
                  if (a + g > d.length) throw Error("input buffer is broken");
                  switch (this.i) {
                    case x:
                      for (; e + g > b.length;) {
                        m = k - e;
                        g -= m;
                        if (r) b.set(d.subarray(a, a + m), e), e += m, a += m;
                        else
                          for (; m--;) b[e++] = d[a++];
                        this.a = e;
                        b = this.e();
                        e = this.a
                      }
                      break;
                    case w:
                      for (; e + g > b.length;) b = this.e({
                        o: 2
                      });
                      break;
                    default:
                      throw Error("invalid inflate mode");
                  }
                  if (r) b.set(d.subarray(a, a + g), e), e += g, a += g;
                  else
                    for (; g--;) b[e++] = d[a++];
                  this.d = a;
                  this.a = e;
                  this.b = b;
                  break;
                case 1:
                  this.j(z,
                    A);
                  break;
                case 2:
                  B(this);
                  break;
                default:
                  throw Error("unknown BTYPE: " + c);
              }
            }
            return this.m()
          };
          var C = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
            D = r ? new Uint16Array(C) : C,
            E = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 258, 258],
            F = r ? new Uint16Array(E) : E,
            G = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0],
            H = r ? new Uint8Array(G) : G,
            I = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577],
            J = r ? new Uint16Array(I) : I,
            K = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
              13
            ],
            L = r ? new Uint8Array(K) : K,
            M = new(r ? Uint8Array : Array)(288),
            N, O;
          N = 0;
          for (O = M.length; N < O; ++N) M[N] = 143 >= N ? 8 : 255 >= N ? 9 : 279 >= N ? 7 : 8;
          var z = u(M),
            P = new(r ? Uint8Array : Array)(30),
            Q, R;
          Q = 0;
          for (R = P.length; Q < R; ++Q) P[Q] = 5;
          var A = u(P);

          function y(c, d) {
            for (var a = c.f, b = c.c, e = c.input, f = c.d, g; b < d;) {
              g = e[f++];
              if (g === l) throw Error("input buffer is broken");
              a |= g << b;
              b += 8
            }
            g = a & (1 << d) - 1;
            c.f = a >>> d;
            c.c = b - d;
            c.d = f;
            return g
          }

          function S(c, d) {
            for (var a = c.f, b = c.c, e = c.input, f = c.d, g = d[0], h = d[1], k, m, s; b < h;) {
              k = e[f++];
              if (k === l) break;
              a |= k << b;
              b += 8
            }
            m = g[a & (1 << h) - 1];
            s = m >>> 16;
            c.f = a >> s;
            c.c = b - s;
            c.d = f;
            return m & 65535
          }

          function B(c) {
            function d(a, c, b) {
              var d, f, e, g;
              for (g = 0; g < a;) switch (d = S(this, c), d) {
                case 16:
                  for (e = 3 + y(this, 2); e--;) b[g++] = f;
                  break;
                case 17:
                  for (e = 3 + y(this, 3); e--;) b[g++] = 0;
                  f = 0;
                  break;
                case 18:
                  for (e = 11 + y(this, 7); e--;) b[g++] = 0;
                  f = 0;
                  break;
                default:
                  f = b[g++] = d
              }
              return b
            }
            var a = y(c, 5) + 257,
              b = y(c, 5) + 1,
              e = y(c, 4) + 4,
              f = new(r ? Uint8Array : Array)(D.length),
              g, h, k, m;
            for (m = 0; m < e; ++m) f[D[m]] = y(c, 3);
            g = u(f);
            h = new(r ? Uint8Array : Array)(a);
            k = new(r ? Uint8Array : Array)(b);
            c.j(u(d.call(c, a, g, h)), u(d.call(c, b, g, k)))
          }
          v.prototype.j = function (c, d) {
            var a = this.b,
              b = this.a;
            this.n = c;
            for (var e = a.length - 258, f, g, h, k; 256 !== (f = S(this, c));)
              if (256 > f) b >= e && (this.a = b, a = this.e(), b = this.a), a[b++] = f;
              else {
                g = f - 257;
                k = F[g];
                0 < H[g] && (k += y(this, H[g]));
                f = S(this, d);
                h = J[f];
                0 < L[f] && (h += y(this, L[f]));
                b >= e && (this.a = b, a = this.e(), b = this.a);
                for (; k--;) a[b] = a[b++ - h]
              }
            for (; 8 <= this.c;) this.c -= 8, this.d--;
            this.a = b
          };
          v.prototype.s = function (c, d) {
            var a = this.b,
              b = this.a;
            this.n = c;
            for (var e = a.length, f, g, h, k; 256 !== (f = S(this, c));)
              if (256 > f) b >= e && (a = this.e(), e = a.length), a[b++] = f;
              else {
                g = f - 257;
                k = F[g];
                0 < H[g] && (k += y(this, H[g]));
                f = S(this, d);
                h = J[f];
                0 < L[f] && (h += y(this, L[f]));
                b + k > e && (a = this.e(), e = a.length);
                for (; k--;) a[b] = a[b++ - h]
              }
            for (; 8 <= this.c;) this.c -= 8, this.d--;
            this.a = b
          };
          v.prototype.e = function () {
            var c = new(r ? Uint8Array : Array)(this.a - 32768),
              d = this.a - 32768,
              a, b, e = this.b;
            if (r) c.set(e.subarray(32768, c.length));
            else {
              a = 0;
              for (b = c.length; a < b; ++a) c[a] = e[a + 32768]
            }
            this.g.push(c);
            this.k += c.length;
            if (r) e.set(e.subarray(d, d + 32768));
            else
              for (a = 0; 32768 > a; ++a) e[a] = e[d + a];
            this.a = 32768;
            return e
          };
          v.prototype.u = function (c) {
            var d, a = this.input.length / this.d + 1 | 0,
              b, e, f, g = this.input,
              h = this.b;
            c && ("number" === typeof c.o && (a = c.o), "number" === typeof c.q && (a += c.q));
            2 > a ? (b = (g.length - this.d) / this.n[2], f = 258 * (b / 2) | 0, e = f < h.length ? h.length + f : h.length << 1) : e = h.length * a;
            r ? (d = new Uint8Array(e), d.set(h)) : d = h;
            return this.b = d
          };
          v.prototype.m = function () {
            var c = 0,
              d = this.b,
              a = this.g,
              b, e = new(r ? Uint8Array : Array)(this.k + (this.a - 32768)),
              f, g, h, k;
            if (0 === a.length) return r ? this.b.subarray(32768, this.a) : this.b.slice(32768, this.a);
            f = 0;
            for (g = a.length; f < g; ++f) {
              b = a[f];
              h = 0;
              for (k = b.length; h < k; ++h) e[c++] = b[h]
            }
            f = 32768;
            for (g = this.a; f < g; ++f) e[c++] = d[f];
            this.g = [];
            return this.buffer = e
          };
          v.prototype.r = function () {
            var c, d = this.a;
            r ? this.p ? (c = new Uint8Array(d), c.set(this.b.subarray(0, d))) : c = this.b.subarray(0, d) : (this.b.length > d && (this.b.length = d), c = this.b);
            return this.buffer = c
          };
          q("Zlib.RawInflate", v);
          q("Zlib.RawInflate.prototype.decompress", v.prototype.t);
          var T = {
              ADAPTIVE: w,
              BLOCK: x
            },
            U, V, W, X;
          if (Object.keys) U = Object.keys(T);
          else
            for (V in U = [], W = 0, T) U[W++] = V;
          W = 0;
          for (X = U.length; W < X; ++W) V = U[W], q("Zlib.RawInflate.BufferType." + V, T[V]);
        }).call(this);


      }).call(context);

      module.exports = function (input) {
        var inflate = new context.Zlib.RawInflate(new Uint8Array(input));
        return inflate.decompress();
      };

    }, {}],
    26: [function (require, module, exports) {
      /**

      JSZip - A Javascript class for generating and reading zip files
      <http://stuartk.com/jszip>

      (c) 2009-2012 Stuart Knightley <stuart [at] stuartk.com>
      Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/master/LICENSE.markdown.

      Usage:
         zip = new JSZip();
         zip.file("hello.txt", "Hello, World!").file("tempfile", "nothing");
         zip.folder("images").file("smile.gif", base64Data, {base64: true});
         zip.file("Xmas.txt", "Ho ho ho !", {date : new Date("December 25, 2007 00:00:01")});
         zip.remove("tempfile");

         base64zip = zip.generate();

      **/

      /**
       * Representation a of zip file in js
       * @constructor
       * @param {String=|ArrayBuffer=|Uint8Array=} data the data to load, if any (optional).
       * @param {Object=} options the options for creating this objects (optional).
       */

      var JSZip = function (data, options) {
        // object containing the files :
        // {
        //   "folder/" : {...},
        //   "folder/data.txt" : {...}
        // }
        this.files = {};

        // Where we are in the hierarchy
        this.root = "";

        if (data) {
          this.load(data, options);
        }
      };



      JSZip.prototype = require('./object');
      JSZip.prototype.clone = function () {
        var newObj = new JSZip();
        for (var i in this) {
          if (typeof this[i] !== "function") {
            newObj[i] = this[i];
          }
        }
        return newObj;
      };
      JSZip.prototype.load = require('./load');
      JSZip.support = require('./support');
      JSZip.utils = require('./utils');
      JSZip.base64 = require('./base64');
      JSZip.compressions = require('./compressions');
      module.exports = JSZip;

    }, {
      "./base64": 18,
      "./compressions": 20,
      "./load": 27,
      "./object": 29,
      "./support": 32,
      "./utils": 34
    }],
    27: [function (require, module, exports) {
      var base64 = require('./base64');
      var ZipEntries = require('./zipEntries');
      module.exports = function (data, options) {
        var files, zipEntries, i, input;
        options = options || {};
        if (options.base64) {
          data = base64.decode(data);
        }

        zipEntries = new ZipEntries(data, options);
        files = zipEntries.files;
        for (i = 0; i < files.length; i++) {
          input = files[i];
          this.file(input.fileName, input.decompressed, {
            binary: true,
            optimizedBinaryString: true,
            date: input.date,
            dir: input.dir
          });
        }

        return this;
      };

    }, {
      "./base64": 18,
      "./zipEntries": 35
    }],
    28: [function (require, module, exports) {
      var Uint8ArrayReader = require('./uint8ArrayReader');

      function NodeBufferReader(data) {
        this.data = data;
        this.length = this.data.length;
        this.index = 0;
      }
      NodeBufferReader.prototype = new Uint8ArrayReader();

      /**
       * @see DataReader.readData
       */
      NodeBufferReader.prototype.readData = function (size) {
        this.checkOffset(size);
        var result = this.data.slice(this.index, this.index + size);
        this.index += size;
        return result;
      };
      module.exports = NodeBufferReader;

    }, {
      "./uint8ArrayReader": 33
    }],
    29: [function (require, module, exports) {
      (function (Buffer) {
        var support = require('./support');
        var utils = require('./utils');
        var signature = require('./signature');
        var defaults = require('./defaults');
        var base64 = require('./base64');
        var compressions = require('./compressions');
        var CompressedObject = require('./compressedObject');
        /**
         * Returns the raw data of a ZipObject, decompress the content if necessary.
         * @param {ZipObject} file the file to use.
         * @return {String|ArrayBuffer|Uint8Array|Buffer} the data.
         */

        var getRawData = function (file) {
          if (file._data instanceof CompressedObject) {
            file._data = file._data.getContent();
            file.options.binary = true;
            file.options.base64 = false;

            if (utils.getTypeOf(file._data) === "uint8array") {
              var copy = file._data;
              // when reading an arraybuffer, the CompressedObject mechanism will keep it and subarray() a Uint8Array.
              // if we request a file in the same format, we might get the same Uint8Array or its ArrayBuffer (the original zip file).
              file._data = new Uint8Array(copy.length);
              // with an empty Uint8Array, Opera fails with a "Offset larger than array size"
              if (copy.length !== 0) {
                file._data.set(copy, 0);
              }
            }
          }
          return file._data;
        };

        /**
         * Returns the data of a ZipObject in a binary form. If the content is an unicode string, encode it.
         * @param {ZipObject} file the file to use.
         * @return {String|ArrayBuffer|Uint8Array|Buffer} the data.
         */
        var getBinaryData = function (file) {
          var result = getRawData(file),
            type = utils.getTypeOf(result);
          if (type === "string") {
            if (!file.options.binary) {
              // unicode text !
              // unicode string => binary string is a painful process, check if we can avoid it.
              if (support.uint8array && typeof TextEncoder === "function") {
                return TextEncoder("utf-8").encode(result);
              }
              if (support.nodebuffer) {
                return new Buffer(result, "utf-8");
              }
            }
            return file.asBinary();
          }
          return result;
        }

        /**
         * Transform this._data into a string.
         * @param {function} filter a function String -> String, applied if not null on the result.
         * @return {String} the string representing this._data.
         */
        var dataToString = function (asUTF8) {
          var result = getRawData(this);
          if (result === null || typeof result === "undefined") {
            return "";
          }
          // if the data is a base64 string, we decode it before checking the encoding !
          if (this.options.base64) {
            result = base64.decode(result);
          }
          if (asUTF8 && this.options.binary) {
            // JSZip.prototype.utf8decode supports arrays as input
            // skip to array => string step, utf8decode will do it.
            result = out.utf8decode(result);
          } else {
            // no utf8 transformation, do the array => string step.
            result = utils.transformTo("string", result);
          }

          if (!asUTF8 && !this.options.binary) {
            result = out.utf8encode(result);
          }
          return result;
        };
        /**
         * A simple object representing a file in the zip file.
         * @constructor
         * @param {string} name the name of the file
         * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data
         * @param {Object} options the options of the file
         */
        var ZipObject = function (name, data, options) {
          this.name = name;
          this._data = data;
          this.options = options;
        };

        ZipObject.prototype = {
          /**
           * Return the content as UTF8 string.
           * @return {string} the UTF8 string.
           */
          asText: function () {
            return dataToString.call(this, true);
          },
          /**
           * Returns the binary content.
           * @return {string} the content as binary.
           */
          asBinary: function () {
            return dataToString.call(this, false);
          },
          /**
           * Returns the content as a nodejs Buffer.
           * @return {Buffer} the content as a Buffer.
           */
          asNodeBuffer: function () {
            var result = getBinaryData(this);
            return utils.transformTo("nodebuffer", result);
          },
          /**
           * Returns the content as an Uint8Array.
           * @return {Uint8Array} the content as an Uint8Array.
           */
          asUint8Array: function () {
            var result = getBinaryData(this);
            return utils.transformTo("uint8array", result);
          },
          /**
           * Returns the content as an ArrayBuffer.
           * @return {ArrayBuffer} the content as an ArrayBufer.
           */
          asArrayBuffer: function () {
            return this.asUint8Array().buffer;
          }
        };

        /**
         * Transform an integer into a string in hexadecimal.
         * @private
         * @param {number} dec the number to convert.
         * @param {number} bytes the number of bytes to generate.
         * @returns {string} the result.
         */
        var decToHex = function (dec, bytes) {
          var hex = "",
            i;
          for (i = 0; i < bytes; i++) {
            hex += String.fromCharCode(dec & 0xff);
            dec = dec >>> 8;
          }
          return hex;
        };

        /**
         * Merge the objects passed as parameters into a new one.
         * @private
         * @param {...Object} var_args All objects to merge.
         * @return {Object} a new object with the data of the others.
         */
        var extend = function () {
          var result = {},
            i, attr;
          for (i = 0; i < arguments.length; i++) { // arguments is not enumerable in some browsers
            for (attr in arguments[i]) {
              if (arguments[i].hasOwnProperty(attr) && typeof result[attr] === "undefined") {
                result[attr] = arguments[i][attr];
              }
            }
          }
          return result;
        };

        /**
         * Transforms the (incomplete) options from the user into the complete
         * set of options to create a file.
         * @private
         * @param {Object} o the options from the user.
         * @return {Object} the complete set of options.
         */
        var prepareFileAttrs = function (o) {
          o = o || {};
          if (o.base64 === true && o.binary == null) {
            o.binary = true;
          }
          o = extend(o, defaults);
          o.date = o.date || new Date();
          if (o.compression !== null) o.compression = o.compression.toUpperCase();

          return o;
        };

        /**
         * Add a file in the current folder.
         * @private
         * @param {string} name the name of the file
         * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data of the file
         * @param {Object} o the options of the file
         * @return {Object} the new file.
         */
        var fileAdd = function (name, data, o) {
          // be sure sub folders exist
          var parent = parentFolder(name),
            dataType = utils.getTypeOf(data);
          if (parent) {
            folderAdd.call(this, parent);
          }

          o = prepareFileAttrs(o);

          if (o.dir || data === null || typeof data === "undefined") {
            o.base64 = false;
            o.binary = false;
            data = null;
          } else if (dataType === "string") {
            if (o.binary && !o.base64) {
              // optimizedBinaryString == true means that the file has already been filtered with a 0xFF mask
              if (o.optimizedBinaryString !== true) {
                // this is a string, not in a base64 format.
                // Be sure that this is a correct "binary string"
                data = utils.string2binary(data);
              }
            }
          } else { // arraybuffer, uint8array, ...
            o.base64 = false;
            o.binary = true;

            if (!dataType && !(data instanceof CompressedObject)) {
              throw new Error("The data of '" + name + "' is in an unsupported format !");
            }

            // special case : it's way easier to work with Uint8Array than with ArrayBuffer
            if (dataType === "arraybuffer") {
              data = utils.transformTo("uint8array", data);
            }
          }

          return this.files[name] = new ZipObject(name, data, o);
        };


        /**
         * Find the parent folder of the path.
         * @private
         * @param {string} path the path to use
         * @return {string} the parent folder, or ""
         */
        var parentFolder = function (path) {
          if (path.slice(-1) == '/') {
            path = path.substring(0, path.length - 1);
          }
          var lastSlash = path.lastIndexOf('/');
          return (lastSlash > 0) ? path.substring(0, lastSlash) : "";
        };

        /**
         * Add a (sub) folder in the current folder.
         * @private
         * @param {string} name the folder's name
         * @return {Object} the new folder.
         */
        var folderAdd = function (name) {
          // Check the name ends with a /
          if (name.slice(-1) != "/") {
            name += "/"; // IE doesn't like substr(-1)
          }

          // Does this folder already exist?
          if (!this.files[name]) {
            fileAdd.call(this, name, null, {
              dir: true
            });
          }
          return this.files[name];
        };

        /**
         * Generate a JSZip.CompressedObject for a given zipOject.
         * @param {ZipObject} file the object to read.
         * @param {JSZip.compression} compression the compression to use.
         * @return {JSZip.CompressedObject} the compressed result.
         */
        var generateCompressedObjectFrom = function (file, compression) {
          var result = new CompressedObject(),
            content;

          // the data has not been decompressed, we might reuse things !
          if (file._data instanceof CompressedObject) {
            result.uncompressedSize = file._data.uncompressedSize;
            result.crc32 = file._data.crc32;

            if (result.uncompressedSize === 0 || file.options.dir) {
              compression = compressions['STORE'];
              result.compressedContent = "";
              result.crc32 = 0;
            } else if (file._data.compressionMethod === compression.magic) {
              result.compressedContent = file._data.getCompressedContent();
            } else {
              content = file._data.getContent()
              // need to decompress / recompress
              result.compressedContent = compression.compress(utils.transformTo(compression.compressInputType, content));
            }
          } else {
            // have uncompressed data
            content = getBinaryData(file);
            if (!content || content.length === 0 || file.options.dir) {
              compression = compressions['STORE'];
              content = "";
            }
            result.uncompressedSize = content.length;
            result.crc32 = this.crc32(content);
            result.compressedContent = compression.compress(utils.transformTo(compression.compressInputType, content));
          }

          result.compressedSize = result.compressedContent.length;
          result.compressionMethod = compression.magic;

          return result;
        };

        /**
         * Generate the various parts used in the construction of the final zip file.
         * @param {string} name the file name.
         * @param {ZipObject} file the file content.
         * @param {JSZip.CompressedObject} compressedObject the compressed object.
         * @param {number} offset the current offset from the start of the zip file.
         * @return {object} the zip parts.
         */
        var generateZipParts = function (name, file, compressedObject, offset) {
          var data = compressedObject.compressedContent,
            utfEncodedFileName = this.utf8encode(file.name),
            useUTF8 = utfEncodedFileName !== file.name,
            o = file.options,
            dosTime,
            dosDate;

          // date
          // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html
          // @see http://www.delorie.com/djgpp/doc/rbinter/it/65/16.html
          // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html

          dosTime = o.date.getHours();
          dosTime = dosTime << 6;
          dosTime = dosTime | o.date.getMinutes();
          dosTime = dosTime << 5;
          dosTime = dosTime | o.date.getSeconds() / 2;

          dosDate = o.date.getFullYear() - 1980;
          dosDate = dosDate << 4;
          dosDate = dosDate | (o.date.getMonth() + 1);
          dosDate = dosDate << 5;
          dosDate = dosDate | o.date.getDate();


          var header = "";

          // version needed to extract
          header += "\x0A\x00";
          // general purpose bit flag
          // set bit 11 if utf8
          header += useUTF8 ? "\x00\x08" : "\x00\x00";
          // compression method
          header += compressedObject.compressionMethod;
          // last mod file time
          header += decToHex(dosTime, 2);
          // last mod file date
          header += decToHex(dosDate, 2);
          // crc-32
          header += decToHex(compressedObject.crc32, 4);
          // compressed size
          header += decToHex(compressedObject.compressedSize, 4);
          // uncompressed size
          header += decToHex(compressedObject.uncompressedSize, 4);
          // file name length
          header += decToHex(utfEncodedFileName.length, 2);
          // extra field length
          header += "\x00\x00";


          var fileRecord = signature.LOCAL_FILE_HEADER + header + utfEncodedFileName;

          var dirRecord = signature.CENTRAL_FILE_HEADER +
            // version made by (00: DOS)
            "\x14\x00" +
            // file header (common to file and central directory)
            header +
            // file comment length
            "\x00\x00" +
            // disk number start
            "\x00\x00" +
            // internal file attributes TODO
            "\x00\x00" +
            // external file attributes
            (file.options.dir === true ? "\x10\x00\x00\x00" : "\x00\x00\x00\x00") +
            // relative offset of local header
            decToHex(offset, 4) +
            // file name
            utfEncodedFileName;


          return {
            fileRecord: fileRecord,
            dirRecord: dirRecord,
            compressedObject: compressedObject
          };
        };

        /**
         * An object to write any content to a string.
         * @constructor
         */
        var StringWriter = function () {
          this.data = [];
        };
        StringWriter.prototype = {
          /**
           * Append any content to the current string.
           * @param {Object} input the content to add.
           */
          append: function (input) {
            input = utils.transformTo("string", input);
            this.data.push(input);
          },
          /**
           * Finalize the construction an return the result.
           * @return {string} the generated string.
           */
          finalize: function () {
            return this.data.join("");
          }
        };
        /**
         * An object to write any content to an Uint8Array.
         * @constructor
         * @param {number} length The length of the array.
         */
        var Uint8ArrayWriter = function (length) {
          this.data = new Uint8Array(length);
          this.index = 0;
        };
        Uint8ArrayWriter.prototype = {
          /**
           * Append any content to the current array.
           * @param {Object} input the content to add.
           */
          append: function (input) {
            if (input.length !== 0) {
              // with an empty Uint8Array, Opera fails with a "Offset larger than array size"
              input = utils.transformTo("uint8array", input);
              this.data.set(input, this.index);
              this.index += input.length;
            }
          },
          /**
           * Finalize the construction an return the result.
           * @return {Uint8Array} the generated array.
           */
          finalize: function () {
            return this.data;
          }
        };

        // return the actual prototype of JSZip
        var out = {
          /**
           * Read an existing zip and merge the data in the current JSZip object.
           * The implementation is in jszip-load.js, don't forget to include it.
           * @param {String|ArrayBuffer|Uint8Array|Buffer} stream  The stream to load
           * @param {Object} options Options for loading the stream.
           *  options.base64 : is the stream in base64 ? default : false
           * @return {JSZip} the current JSZip object
           */
          load: function (stream, options) {
            throw new Error("Load method is not defined. Is the file jszip-load.js included ?");
          },

          /**
           * Filter nested files/folders with the specified function.
           * @param {Function} search the predicate to use :
           * function (relativePath, file) {...}
           * It takes 2 arguments : the relative path and the file.
           * @return {Array} An array of matching elements.
           */
          filter: function (search) {
            var result = [],
              filename, relativePath, file, fileClone;
            for (filename in this.files) {
              if (!this.files.hasOwnProperty(filename)) {
                continue;
              }
              file = this.files[filename];
              // return a new object, don't let the user mess with our internal objects :)
              fileClone = new ZipObject(file.name, file._data, extend(file.options));
              relativePath = filename.slice(this.root.length, filename.length);
              if (filename.slice(0, this.root.length) === this.root && // the file is in the current root
                search(relativePath, fileClone)) { // and the file matches the function
                result.push(fileClone);
              }
            }
            return result;
          },

          /**
           * Add a file to the zip file, or search a file.
           * @param   {string|RegExp} name The name of the file to add (if data is defined),
           * the name of the file to find (if no data) or a regex to match files.
           * @param   {String|ArrayBuffer|Uint8Array|Buffer} data  The file data, either raw or base64 encoded
           * @param   {Object} o     File options
           * @return  {JSZip|Object|Array} this JSZip object (when adding a file),
           * a file (when searching by string) or an array of files (when searching by regex).
           */
          file: function (name, data, o) {
            if (arguments.length === 1) {
              if (name instanceof RegExp) {
                var regexp = name;
                return this.filter(function (relativePath, file) {
                  return !file.options.dir && regexp.test(relativePath);
                });
              } else { // text
                return this.filter(function (relativePath, file) {
                  return !file.options.dir && relativePath === name;
                })[0] || null;
              }
            } else { // more than one argument : we have data !
              name = this.root + name;
              fileAdd.call(this, name, data, o);
            }
            return this;
          },

          /**
           * Add a directory to the zip file, or search.
           * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
           * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
           */
          folder: function (arg) {
            if (!arg) {
              return this;
            }

            if (arg instanceof RegExp) {
              return this.filter(function (relativePath, file) {
                return file.options.dir && arg.test(relativePath);
              });
            }

            // else, name is a new folder
            var name = this.root + arg;
            var newFolder = folderAdd.call(this, name);

            // Allow chaining by returning a new object with this folder as the root
            var ret = this.clone();
            ret.root = newFolder.name;
            return ret;
          },

          /**
           * Delete a file, or a directory and all sub-files, from the zip
           * @param {string} name the name of the file to delete
           * @return {JSZip} this JSZip object
           */
          remove: function (name) {
            name = this.root + name;
            var file = this.files[name];
            if (!file) {
              // Look for any folders
              if (name.slice(-1) != "/") {
                name += "/";
              }
              file = this.files[name];
            }

            if (file) {
              if (!file.options.dir) {
                // file
                delete this.files[name];
              } else {
                // folder
                var kids = this.filter(function (relativePath, file) {
                  return file.name.slice(0, name.length) === name;
                });
                for (var i = 0; i < kids.length; i++) {
                  delete this.files[kids[i].name];
                }
              }
            }

            return this;
          },

          /**
           * Generate the complete zip file
           * @param {Object} options the options to generate the zip file :
           * - base64, (deprecated, use type instead) true to generate base64.
           * - compression, "STORE" by default.
           * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
           * @return {String|Uint8Array|ArrayBuffer|Buffer|Blob} the zip file
           */
          generate: function (options) {
            options = extend(options || {}, {
              base64: true,
              compression: "STORE",
              type: "base64"
            });

            utils.checkSupport(options.type);

            var zipData = [],
              localDirLength = 0,
              centralDirLength = 0,
              writer, i;


            // first, generate all the zip parts.
            for (var name in this.files) {
              if (!this.files.hasOwnProperty(name)) {
                continue;
              }
              var file = this.files[name];

              var compressionName = file.options.compression || options.compression.toUpperCase();
              var compression = compressions[compressionName];
              if (!compression) {
                throw new Error(compressionName + " is not a valid compression method !");
              }

              var compressedObject = generateCompressedObjectFrom.call(this, file, compression);

              var zipPart = generateZipParts.call(this, name, file, compressedObject, localDirLength);
              localDirLength += zipPart.fileRecord.length + compressedObject.compressedSize;
              centralDirLength += zipPart.dirRecord.length;
              zipData.push(zipPart);
            }

            var dirEnd = "";

            // end of central dir signature
            dirEnd = signature.CENTRAL_DIRECTORY_END +
              // number of this disk
              "\x00\x00" +
              // number of the disk with the start of the central directory
              "\x00\x00" +
              // total number of entries in the central directory on this disk
              decToHex(zipData.length, 2) +
              // total number of entries in the central directory
              decToHex(zipData.length, 2) +
              // size of the central directory   4 bytes
              decToHex(centralDirLength, 4) +
              // offset of start of central directory with respect to the starting disk number
              decToHex(localDirLength, 4) +
              // .ZIP file comment length
              "\x00\x00";


            // we have all the parts (and the total length)
            // time to create a writer !
            switch (options.type.toLowerCase()) {
              case "uint8array":
              case "arraybuffer":
              case "blob":
              case "nodebuffer":
                writer = new Uint8ArrayWriter(localDirLength + centralDirLength + dirEnd.length);
                break;
              case "base64":
              default:
                // case "string" :
                writer = new StringWriter(localDirLength + centralDirLength + dirEnd.length);
                break;
            }

            for (i = 0; i < zipData.length; i++) {
              writer.append(zipData[i].fileRecord);
              writer.append(zipData[i].compressedObject.compressedContent);
            }
            for (i = 0; i < zipData.length; i++) {
              writer.append(zipData[i].dirRecord);
            }

            writer.append(dirEnd);

            var zip = writer.finalize();



            switch (options.type.toLowerCase()) {
              // case "zip is an Uint8Array"
              case "uint8array":
              case "arraybuffer":
              case "nodebuffer":
                return utils.transformTo(options.type.toLowerCase(), zip);
              case "blob":
                return utils.arrayBuffer2Blob(utils.transformTo("arraybuffer", zip));

                // case "zip is a string"
              case "base64":
                return (options.base64) ? base64.encode(zip) : zip;
              default:
                // case "string" :
                return zip;
            }
          },

          /**
           *
           *  Javascript crc32
           *  http://www.webtoolkit.info/
           *
           */
          crc32: function crc32(input, crc) {
            if (typeof input === "undefined" || !input.length) {
              return 0;
            }

            var isArray = utils.getTypeOf(input) !== "string";

            var table = [
              0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
              0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
              0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
              0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
              0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
              0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
              0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
              0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
              0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
              0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
              0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
              0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
              0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
              0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
              0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
              0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
              0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
              0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
              0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
              0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
              0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
              0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
              0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
              0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
              0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
              0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
              0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
              0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
              0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
              0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
              0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
              0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
              0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
              0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
              0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
              0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
              0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
              0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
              0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
              0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
              0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
              0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
              0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
              0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
              0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
              0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
              0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
              0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
              0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
              0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
              0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
              0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
              0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
              0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
              0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
              0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
              0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
              0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
              0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
              0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
              0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
              0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
              0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
              0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
            ];

            if (typeof (crc) == "undefined") {
              crc = 0;
            }
            var x = 0;
            var y = 0;
            var byte = 0;

            crc = crc ^ (-1);
            for (var i = 0, iTop = input.length; i < iTop; i++) {
              byte = isArray ? input[i] : input.charCodeAt(i);
              y = (crc ^ byte) & 0xFF;
              x = table[y];
              crc = (crc >>> 8) ^ x;
            }

            return crc ^ (-1);
          },

          // Inspired by http://my.opera.com/GreyWyvern/blog/show.dml/1725165

          /**
           * http://www.webtoolkit.info/javascript-utf8.html
           */
          utf8encode: function (string) {
            // TextEncoder + Uint8Array to binary string is faster than checking every bytes on long strings.
            // http://jsperf.com/utf8encode-vs-textencoder
            // On short strings (file names for example), the TextEncoder API is (currently) slower.
            if (support.uint8array && typeof TextEncoder === "function") {
              var u8 = TextEncoder("utf-8").encode(string);
              return utils.transformTo("string", u8);
            }
            if (support.nodebuffer) {
              return utils.transformTo("string", new Buffer(string, "utf-8"));
            }

            // array.join may be slower than string concatenation but generates less objects (less time spent garbage collecting).
            // See also http://jsperf.com/array-direct-assignment-vs-push/31
            var result = [],
              resIndex = 0;

            for (var n = 0; n < string.length; n++) {

              var c = string.charCodeAt(n);

              if (c < 128) {
                result[resIndex++] = String.fromCharCode(c);
              } else if ((c > 127) && (c < 2048)) {
                result[resIndex++] = String.fromCharCode((c >> 6) | 192);
                result[resIndex++] = String.fromCharCode((c & 63) | 128);
              } else {
                result[resIndex++] = String.fromCharCode((c >> 12) | 224);
                result[resIndex++] = String.fromCharCode(((c >> 6) & 63) | 128);
                result[resIndex++] = String.fromCharCode((c & 63) | 128);
              }

            }

            return result.join("");
          },

          /**
           * http://www.webtoolkit.info/javascript-utf8.html
           */
          utf8decode: function (input) {
            var result = [],
              resIndex = 0;
            var type = utils.getTypeOf(input);
            var isArray = type !== "string";
            var i = 0;
            var c = 0,
              c1 = 0,
              c2 = 0,
              c3 = 0;

            // check if we can use the TextDecoder API
            // see http://encoding.spec.whatwg.org/#api
            if (support.uint8array && typeof TextDecoder === "function") {
              return TextDecoder("utf-8").decode(
                utils.transformTo("uint8array", input));
            }
            if (support.nodebuffer) {
              return utils.transformTo("nodebuffer", input).toString("utf-8");
            }

            while (i < input.length) {

              c = isArray ? input[i] : input.charCodeAt(i);

              if (c < 128) {
                result[resIndex++] = String.fromCharCode(c);
                i++;
              } else if ((c > 191) && (c < 224)) {
                c2 = isArray ? input[i + 1] : input.charCodeAt(i + 1);
                result[resIndex++] = String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
              } else {
                c2 = isArray ? input[i + 1] : input.charCodeAt(i + 1);
                c3 = isArray ? input[i + 2] : input.charCodeAt(i + 2);
                result[resIndex++] = String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
              }

            }

            return result.join("");
          }
        };
        module.exports = out;

      }).call(this, require("buffer").Buffer)
    }, {
      "./base64": 18,
      "./compressedObject": 19,
      "./compressions": 20,
      "./defaults": 22,
      "./signature": 30,
      "./support": 32,
      "./utils": 34,
      "buffer": 14
    }],
    30: [function (require, module, exports) {
      exports.LOCAL_FILE_HEADER = "PK\x03\x04";
      exports.CENTRAL_FILE_HEADER = "PK\x01\x02";
      exports.CENTRAL_DIRECTORY_END = "PK\x05\x06";
      exports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
      exports.ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
      exports.DATA_DESCRIPTOR = "PK\x07\x08";

    }, {}],
    31: [function (require, module, exports) {
      var DataReader = require('./dataReader');
      var utils = require('./utils');

      function StringReader(data, optimizedBinaryString) {
        this.data = data;
        if (!optimizedBinaryString) {
          this.data = utils.string2binary(this.data);
        }
        this.length = this.data.length;
        this.index = 0;
      }
      StringReader.prototype = new DataReader();
      /**
       * @see DataReader.byteAt
       */
      StringReader.prototype.byteAt = function (i) {
        return this.data.charCodeAt(i);
      };
      /**
       * @see DataReader.lastIndexOfSignature
       */
      StringReader.prototype.lastIndexOfSignature = function (sig) {
        return this.data.lastIndexOf(sig);
      };
      /**
       * @see DataReader.readData
       */
      StringReader.prototype.readData = function (size) {
        this.checkOffset(size);
        // this will work because the constructor applied the "& 0xff" mask.
        var result = this.data.slice(this.index, this.index + size);
        this.index += size;
        return result;
      };
      module.exports = StringReader;
    }, {
      "./dataReader": 21,
      "./utils": 34
    }],
    32: [function (require, module, exports) {
      (function (Buffer) {
        exports.base64 = true;
        exports.array = true;
        exports.string = true;
        exports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
        // contains true if JSZip can read/generate nodejs Buffer, false otherwise.
        exports.nodebuffer = typeof Buffer !== "undefined";
        // contains true if JSZip can read/generate Uint8Array, false otherwise.
        exports.uint8array = typeof Uint8Array !== "undefined";

        if (typeof ArrayBuffer === "undefined") {
          exports.blob = false;
        } else {
          var buffer = new ArrayBuffer(0);
          try {
            exports.blob = new Blob([buffer], {
              type: "application/zip"
            }).size === 0;
          } catch (e) {
            try {
              var b = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
              var builder = new b();
              builder.append(buffer);
              exports.blob = builder.getBlob('application/zip').size === 0;
            } catch (e) {
              exports.blob = false;
            }
          }
        }

      }).call(this, require("buffer").Buffer)
    }, {
      "buffer": 14
    }],
    33: [function (require, module, exports) {
      var DataReader = require('./dataReader');

      function Uint8ArrayReader(data) {
        if (data) {
          this.data = data;
          this.length = this.data.length;
          this.index = 0;
        }
      }
      Uint8ArrayReader.prototype = new DataReader();
      /**
       * @see DataReader.byteAt
       */
      Uint8ArrayReader.prototype.byteAt = function (i) {
        return this.data[i];
      };
      /**
       * @see DataReader.lastIndexOfSignature
       */
      Uint8ArrayReader.prototype.lastIndexOfSignature = function (sig) {
        var sig0 = sig.charCodeAt(0),
          sig1 = sig.charCodeAt(1),
          sig2 = sig.charCodeAt(2),
          sig3 = sig.charCodeAt(3);
        for (var i = this.length - 4; i >= 0; --i) {
          if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) {
            return i;
          }
        }

        return -1;
      };
      /**
       * @see DataReader.readData
       */
      Uint8ArrayReader.prototype.readData = function (size) {
        this.checkOffset(size);
        var result = this.data.subarray(this.index, this.index + size);
        this.index += size;
        return result;
      };
      module.exports = Uint8ArrayReader;
    }, {
      "./dataReader": 21
    }],
    34: [function (require, module, exports) {
      (function (Buffer) {
        var support = require('./support');
        var compressions = require('./compressions');
        /**
         * Convert a string to a "binary string" : a string containing only char codes between 0 and 255.
         * @param {string} str the string to transform.
         * @return {String} the binary string.
         */
        exports.string2binary = function (str) {
          var result = "";
          for (var i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) & 0xff);
          }
          return result;
        };
        /**
         * Create a Uint8Array from the string.
         * @param {string} str the string to transform.
         * @return {Uint8Array} the typed array.
         * @throws {Error} an Error if the browser doesn't support the requested feature.
         */
        exports.string2Uint8Array = function (str) {
          return exports.transformTo("uint8array", str);
        };

        /**
         * Create a string from the Uint8Array.
         * @param {Uint8Array} array the array to transform.
         * @return {string} the string.
         * @throws {Error} an Error if the browser doesn't support the requested feature.
         */
        exports.uint8Array2String = function (array) {
          return exports.transformTo("string", array);
        };
        /**
         * Create a blob from the given string.
         * @param {string} str the string to transform.
         * @return {Blob} the string.
         * @throws {Error} an Error if the browser doesn't support the requested feature.
         */
        exports.string2Blob = function (str) {
          var buffer = exports.transformTo("arraybuffer", str);
          return exports.arrayBuffer2Blob(buffer);
        };
        exports.arrayBuffer2Blob = function (buffer) {
          exports.checkSupport("blob");

          try {
            // Blob constructor
            return new Blob([buffer], {
              type: "application/zip"
            });
          } catch (e) {

            try {
              // deprecated, browser only, old way
              var builder = new(window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder)();
              builder.append(buffer);
              return builder.getBlob('application/zip');
            } catch (e) {

              // well, fuck ?!
              throw new Error("Bug : can't construct the Blob.");
            }
          }


        };
        /**
         * The identity function.
         * @param {Object} input the input.
         * @return {Object} the same input.
         */
        function identity(input) {
          return input;
        };

        /**
         * Fill in an array with a string.
         * @param {String} str the string to use.
         * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to fill in (will be mutated).
         * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated array.
         */
        function stringToArrayLike(str, array) {
          for (var i = 0; i < str.length; ++i) {
            array[i] = str.charCodeAt(i) & 0xFF;
          }
          return array;
        };

        /**
         * Transform an array-like object to a string.
         * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
         * @return {String} the result.
         */
        function arrayLikeToString(array) {
          // Performances notes :
          // --------------------
          // String.fromCharCode.apply(null, array) is the fastest, see
          // see http://jsperf.com/converting-a-uint8array-to-a-string/2
          // but the stack is limited (and we can get huge arrays !).
          //
          // result += String.fromCharCode(array[i]); generate too many strings !
          //
          // This code is inspired by http://jsperf.com/arraybuffer-to-string-apply-performance/2
          var chunk = 65536;
          var result = [],
            len = array.length,
            type = exports.getTypeOf(array),
            k = 0;

          while (k < len && chunk > 1) {
            try {
              if (type === "array" || type === "nodebuffer") {
                result.push(String.fromCharCode.apply(null, array.slice(k, Math.max(k + chunk, len))));
              } else {
                result.push(String.fromCharCode.apply(null, array.subarray(k, k + chunk)));
              }
              k += chunk;
            } catch (e) {
              chunk = Math.floor(chunk / 2);
            }
          }
          return result.join("");
        };

        /**
         * Copy the data from an array-like to an other array-like.
         * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayFrom the origin array.
         * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayTo the destination array which will be mutated.
         * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated destination array.
         */
        function arrayLikeToArrayLike(arrayFrom, arrayTo) {
          for (var i = 0; i < arrayFrom.length; i++) {
            arrayTo[i] = arrayFrom[i];
          }
          return arrayTo;
        };

        // a matrix containing functions to transform everything into everything.
        var transform = {};

        // string to ?
        transform["string"] = {
          "string": identity,
          "array": function (input) {
            return stringToArrayLike(input, new Array(input.length));
          },
          "arraybuffer": function (input) {
            return transform["string"]["uint8array"](input).buffer;
          },
          "uint8array": function (input) {
            return stringToArrayLike(input, new Uint8Array(input.length));
          },
          "nodebuffer": function (input) {
            return stringToArrayLike(input, new Buffer(input.length));
          }
        };

        // array to ?
        transform["array"] = {
          "string": arrayLikeToString,
          "array": identity,
          "arraybuffer": function (input) {
            return (new Uint8Array(input)).buffer;
          },
          "uint8array": function (input) {
            return new Uint8Array(input);
          },
          "nodebuffer": function (input) {
            return new Buffer(input);
          }
        };

        // arraybuffer to ?
        transform["arraybuffer"] = {
          "string": function (input) {
            return arrayLikeToString(new Uint8Array(input));
          },
          "array": function (input) {
            return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
          },
          "arraybuffer": identity,
          "uint8array": function (input) {
            return new Uint8Array(input);
          },
          "nodebuffer": function (input) {
            return new Buffer(new Uint8Array(input));
          }
        };

        // uint8array to ?
        transform["uint8array"] = {
          "string": arrayLikeToString,
          "array": function (input) {
            return arrayLikeToArrayLike(input, new Array(input.length));
          },
          "arraybuffer": function (input) {
            return input.buffer;
          },
          "uint8array": identity,
          "nodebuffer": function (input) {
            return new Buffer(input);
          }
        };

        // nodebuffer to ?
        transform["nodebuffer"] = {
          "string": arrayLikeToString,
          "array": function (input) {
            return arrayLikeToArrayLike(input, new Array(input.length));
          },
          "arraybuffer": function (input) {
            return transform["nodebuffer"]["uint8array"](input).buffer;
          },
          "uint8array": function (input) {
            return arrayLikeToArrayLike(input, new Uint8Array(input.length));
          },
          "nodebuffer": identity
        };

        /**
         * Transform an input into any type.
         * The supported output type are : string, array, uint8array, arraybuffer, nodebuffer.
         * If no output type is specified, the unmodified input will be returned.
         * @param {String} outputType the output type.
         * @param {String|Array|ArrayBuffer|Uint8Array|Buffer} input the input to convert.
         * @throws {Error} an Error if the browser doesn't support the requested output type.
         */
        exports.transformTo = function (outputType, input) {
          if (!input) {
            // undefined, null, etc
            // an empty string won't harm.
            input = "";
          }
          if (!outputType) {
            return input;
          }
          exports.checkSupport(outputType);
          var inputType = exports.getTypeOf(input);
          var result = transform[inputType][outputType](input);
          return result;
        };

        /**
         * Return the type of the input.
         * The type will be in a format valid for JSZip.utils.transformTo : string, array, uint8array, arraybuffer.
         * @param {Object} input the input to identify.
         * @return {String} the (lowercase) type of the input.
         */
        exports.getTypeOf = function (input) {
          if (typeof input === "string") {
            return "string";
          }
          if (input instanceof Array) {
            return "array";
          }
          if (support.nodebuffer && Buffer.isBuffer(input)) {
            return "nodebuffer";
          }
          if (support.uint8array && input instanceof Uint8Array) {
            return "uint8array";
          }
          if (support.arraybuffer && input instanceof ArrayBuffer) {
            return "arraybuffer";
          }
        };

        /**
         * Throw an exception if the type is not supported.
         * @param {String} type the type to check.
         * @throws {Error} an Error if the browser doesn't support the requested type.
         */
        exports.checkSupport = function (type) {
          var supported = support[type.toLowerCase()];
          if (!supported) {
            throw new Error(type + " is not supported by this browser");
          }
        };
        exports.MAX_VALUE_16BITS = 65535;
        exports.MAX_VALUE_32BITS = -1; // well, "\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF" is parsed as -1

        /**
         * Prettify a string read as binary.
         * @param {string} str the string to prettify.
         * @return {string} a pretty string.
         */
        exports.pretty = function (str) {
          var res = '',
            code, i;
          for (i = 0; i < (str || "").length; i++) {
            code = str.charCodeAt(i);
            res += '\\x' + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
          }
          return res;
        };

        /**
         * Find a compression registered in JSZip.
         * @param {string} compressionMethod the method magic to find.
         * @return {Object|null} the JSZip compression object, null if none found.
         */
        exports.findCompression = function (compressionMethod) {
          for (var method in compressions) {
            if (!compressions.hasOwnProperty(method)) {
              continue;
            }
            if (compressions[method].magic === compressionMethod) {
              return compressions[method];
            }
          }
          return null;
        };

      }).call(this, require("buffer").Buffer)
    }, {
      "./compressions": 20,
      "./support": 32,
      "buffer": 14
    }],
    35: [function (require, module, exports) {
      var StringReader = require('./stringReader');
      var NodeBufferReader = require('./nodeBufferReader');
      var Uint8ArrayReader = require('./uint8ArrayReader');
      var utils = require('./utils');
      var sig = require('./signature');
      var ZipEntry = require('./zipEntry');
      var support = require('./support');
      //  class ZipEntries {{{
      /**
       * All the entries in the zip file.
       * @constructor
       * @param {String|ArrayBuffer|Uint8Array} data the binary stream to load.
       * @param {Object} loadOptions Options for loading the stream.
       */
      function ZipEntries(data, loadOptions) {
        this.files = [];
        this.loadOptions = loadOptions;
        if (data) {
          this.load(data);
        }
      }
      ZipEntries.prototype = {
        /**
         * Check that the reader is on the speficied signature.
         * @param {string} expectedSignature the expected signature.
         * @throws {Error} if it is an other signature.
         */
        checkSignature: function (expectedSignature) {
          var signature = this.reader.readString(4);
          if (signature !== expectedSignature) {
            throw new Error("Corrupted zip or bug : unexpected signature " + "(" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");
          }
        },
        /**
         * Read the end of the central directory.
         */
        readBlockEndOfCentral: function () {
          this.diskNumber = this.reader.readInt(2);
          this.diskWithCentralDirStart = this.reader.readInt(2);
          this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
          this.centralDirRecords = this.reader.readInt(2);
          this.centralDirSize = this.reader.readInt(4);
          this.centralDirOffset = this.reader.readInt(4);

          this.zipCommentLength = this.reader.readInt(2);
          this.zipComment = this.reader.readString(this.zipCommentLength);
        },
        /**
         * Read the end of the Zip 64 central directory.
         * Not merged with the method readEndOfCentral :
         * The end of central can coexist with its Zip64 brother,
         * I don't want to read the wrong number of bytes !
         */
        readBlockZip64EndOfCentral: function () {
          this.zip64EndOfCentralSize = this.reader.readInt(8);
          this.versionMadeBy = this.reader.readString(2);
          this.versionNeeded = this.reader.readInt(2);
          this.diskNumber = this.reader.readInt(4);
          this.diskWithCentralDirStart = this.reader.readInt(4);
          this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
          this.centralDirRecords = this.reader.readInt(8);
          this.centralDirSize = this.reader.readInt(8);
          this.centralDirOffset = this.reader.readInt(8);

          this.zip64ExtensibleData = {};
          var extraDataSize = this.zip64EndOfCentralSize - 44,
            index = 0,
            extraFieldId,
            extraFieldLength,
            extraFieldValue;
          while (index < extraDataSize) {
            extraFieldId = this.reader.readInt(2);
            extraFieldLength = this.reader.readInt(4);
            extraFieldValue = this.reader.readString(extraFieldLength);
            this.zip64ExtensibleData[extraFieldId] = {
              id: extraFieldId,
              length: extraFieldLength,
              value: extraFieldValue
            };
          }
        },
        /**
         * Read the end of the Zip 64 central directory locator.
         */
        readBlockZip64EndOfCentralLocator: function () {
          this.diskWithZip64CentralDirStart = this.reader.readInt(4);
          this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
          this.disksCount = this.reader.readInt(4);
          if (this.disksCount > 1) {
            throw new Error("Multi-volumes zip are not supported");
          }
        },
        /**
         * Read the local files, based on the offset read in the central part.
         */
        readLocalFiles: function () {
          var i, file;
          for (i = 0; i < this.files.length; i++) {
            file = this.files[i];
            this.reader.setIndex(file.localHeaderOffset);
            this.checkSignature(sig.LOCAL_FILE_HEADER);
            file.readLocalPart(this.reader);
            file.handleUTF8();
          }
        },
        /**
         * Read the central directory.
         */
        readCentralDir: function () {
          var file;

          this.reader.setIndex(this.centralDirOffset);
          while (this.reader.readString(4) === sig.CENTRAL_FILE_HEADER) {
            file = new ZipEntry({
              zip64: this.zip64
            }, this.loadOptions);
            file.readCentralPart(this.reader);
            this.files.push(file);
          }
        },
        /**
         * Read the end of central directory.
         */
        readEndOfCentral: function () {
          var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
          if (offset === -1) {
            throw new Error("Corrupted zip : can't find end of central directory");
          }
          this.reader.setIndex(offset);
          this.checkSignature(sig.CENTRAL_DIRECTORY_END);
          this.readBlockEndOfCentral();


          /* extract from the zip spec :
              4)  If one of the fields in the end of central directory
                  record is too small to hold required data, the field
                  should be set to -1 (0xFFFF or 0xFFFFFFFF) and the
                  ZIP64 format record should be created.
              5)  The end of central directory record and the
                  Zip64 end of central directory locator record must
                  reside on the same disk when splitting or spanning
                  an archive.
           */
          if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {
            this.zip64 = true;

            /*
            Warning : the zip64 extension is supported, but ONLY if the 64bits integer read from
            the zip file can fit into a 32bits integer. This cannot be solved : Javascript represents
            all numbers as 64-bit double precision IEEE 754 floating point numbers.
            So, we have 53bits for integers and bitwise operations treat everything as 32bits.
            see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators
            and http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf section 8.5
            */

            // should look for a zip64 EOCD locator
            offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
            if (offset === -1) {
              throw new Error("Corrupted zip : can't find the ZIP64 end of central directory locator");
            }
            this.reader.setIndex(offset);
            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
            this.readBlockZip64EndOfCentralLocator();

            // now the zip64 EOCD record
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
            this.readBlockZip64EndOfCentral();
          }
        },
        prepareReader: function (data) {
          var type = utils.getTypeOf(data);
          if (type === "string" && !support.uint8array) {
            this.reader = new StringReader(data, this.loadOptions.optimizedBinaryString);
          } else if (type === "nodebuffer") {
            this.reader = new NodeBufferReader(data);
          } else {
            this.reader = new Uint8ArrayReader(utils.transformTo("uint8array", data));
          }
        },
        /**
         * Read a zip file and create ZipEntries.
         * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
         */
        load: function (data) {
          this.prepareReader(data);
          this.readEndOfCentral();
          this.readCentralDir();
          this.readLocalFiles();
        }
      };
      // }}} end of ZipEntries
      module.exports = ZipEntries;
    }, {
      "./nodeBufferReader": 28,
      "./signature": 30,
      "./stringReader": 31,
      "./support": 32,
      "./uint8ArrayReader": 33,
      "./utils": 34,
      "./zipEntry": 36
    }],
    36: [function (require, module, exports) {
      var StringReader = require('./stringReader');
      var utils = require('./utils');
      var CompressedObject = require('./compressedObject');
      var jszipProto = require('./object');
      // class ZipEntry {{{
      /**
       * An entry in the zip file.
       * @constructor
       * @param {Object} options Options of the current file.
       * @param {Object} loadOptions Options for loading the stream.
       */
      function ZipEntry(options, loadOptions) {
        this.options = options;
        this.loadOptions = loadOptions;
      }
      ZipEntry.prototype = {
        /**
         * say if the file is encrypted.
         * @return {boolean} true if the file is encrypted, false otherwise.
         */
        isEncrypted: function () {
          // bit 1 is set
          return (this.bitFlag & 0x0001) === 0x0001;
        },
        /**
         * say if the file has utf-8 filename/comment.
         * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
         */
        useUTF8: function () {
          // bit 11 is set
          return (this.bitFlag & 0x0800) === 0x0800;
        },
        /**
         * Prepare the function used to generate the compressed content from this ZipFile.
         * @param {DataReader} reader the reader to use.
         * @param {number} from the offset from where we should read the data.
         * @param {number} length the length of the data to read.
         * @return {Function} the callback to get the compressed content (the type depends of the DataReader class).
         */
        prepareCompressedContent: function (reader, from, length) {
          return function () {
            var previousIndex = reader.index;
            reader.setIndex(from);
            var compressedFileData = reader.readData(length);
            reader.setIndex(previousIndex);

            return compressedFileData;
          }
        },
        /**
         * Prepare the function used to generate the uncompressed content from this ZipFile.
         * @param {DataReader} reader the reader to use.
         * @param {number} from the offset from where we should read the data.
         * @param {number} length the length of the data to read.
         * @param {JSZip.compression} compression the compression used on this file.
         * @param {number} uncompressedSize the uncompressed size to expect.
         * @return {Function} the callback to get the uncompressed content (the type depends of the DataReader class).
         */
        prepareContent: function (reader, from, length, compression, uncompressedSize) {
          return function () {

            var compressedFileData = utils.transformTo(compression.uncompressInputType, this.getCompressedContent());
            var uncompressedFileData = compression.uncompress(compressedFileData);

            if (uncompressedFileData.length !== uncompressedSize) {
              throw new Error("Bug : uncompressed data size mismatch");
            }

            return uncompressedFileData;
          }
        },
        /**
         * Read the local part of a zip file and add the info in this object.
         * @param {DataReader} reader the reader to use.
         */
        readLocalPart: function (reader) {
          var compression, localExtraFieldsLength;

          // we already know everything from the central dir !
          // If the central dir data are false, we are doomed.
          // On the bright side, the local part is scary  : zip64, data descriptors, both, etc.
          // The less data we get here, the more reliable this should be.
          // Let's skip the whole header and dash to the data !
          reader.skip(22);
          // in some zip created on windows, the filename stored in the central dir contains \ instead of /.
          // Strangely, the filename here is OK.
          // I would love to treat these zip files as corrupted (see http://www.info-zip.org/FAQ.html#backslashes
          // or APPNOTE#4.4.17.1, "All slashes MUST be forward slashes '/'") but there are a lot of bad zip generators...
          // Search "unzip mismatching "local" filename continuing with "central" filename version" on
          // the internet.
          //
          // I think I see the logic here : the central directory is used to display
          // content and the local directory is used to extract the files. Mixing / and \
          // may be used to display \ to windows users and use / when extracting the files.
          // Unfortunately, this lead also to some issues : http://seclists.org/fulldisclosure/2009/Sep/394
          this.fileNameLength = reader.readInt(2);
          localExtraFieldsLength = reader.readInt(2); // can't be sure this will be the same as the central dir
          this.fileName = reader.readString(this.fileNameLength);
          reader.skip(localExtraFieldsLength);

          if (this.compressedSize == -1 || this.uncompressedSize == -1) {
            throw new Error("Bug or corrupted zip : didn't get enough informations from the central directory " + "(compressedSize == -1 || uncompressedSize == -1)");
          }

          compression = utils.findCompression(this.compressionMethod);
          if (compression === null) { // no compression found
            throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " + this.fileName + ")");
          }
          this.decompressed = new CompressedObject();
          this.decompressed.compressedSize = this.compressedSize;
          this.decompressed.uncompressedSize = this.uncompressedSize;
          this.decompressed.crc32 = this.crc32;
          this.decompressed.compressionMethod = this.compressionMethod;
          this.decompressed.getCompressedContent = this.prepareCompressedContent(reader, reader.index, this.compressedSize, compression);
          this.decompressed.getContent = this.prepareContent(reader, reader.index, this.compressedSize, compression, this.uncompressedSize);

          // we need to compute the crc32...
          if (this.loadOptions.checkCRC32) {
            this.decompressed = utils.transformTo("string", this.decompressed.getContent());
            if (jszipProto.crc32(this.decompressed) !== this.crc32) {
              throw new Error("Corrupted zip : CRC32 mismatch");
            }
          }
        },

        /**
         * Read the central part of a zip file and add the info in this object.
         * @param {DataReader} reader the reader to use.
         */
        readCentralPart: function (reader) {
          this.versionMadeBy = reader.readString(2);
          this.versionNeeded = reader.readInt(2);
          this.bitFlag = reader.readInt(2);
          this.compressionMethod = reader.readString(2);
          this.date = reader.readDate();
          this.crc32 = reader.readInt(4);
          this.compressedSize = reader.readInt(4);
          this.uncompressedSize = reader.readInt(4);
          this.fileNameLength = reader.readInt(2);
          this.extraFieldsLength = reader.readInt(2);
          this.fileCommentLength = reader.readInt(2);
          this.diskNumberStart = reader.readInt(2);
          this.internalFileAttributes = reader.readInt(2);
          this.externalFileAttributes = reader.readInt(4);
          this.localHeaderOffset = reader.readInt(4);

          if (this.isEncrypted()) {
            throw new Error("Encrypted zip are not supported");
          }

          this.fileName = reader.readString(this.fileNameLength);
          this.readExtraFields(reader);
          this.parseZIP64ExtraField(reader);
          this.fileComment = reader.readString(this.fileCommentLength);

          // warning, this is true only for zip with madeBy == DOS (plateform dependent feature)
          this.dir = this.externalFileAttributes & 0x00000010 ? true : false;
        },
        /**
         * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
         * @param {DataReader} reader the reader to use.
         */
        parseZIP64ExtraField: function (reader) {

          if (!this.extraFields[0x0001]) {
            return;
          }

          // should be something, preparing the extra reader
          var extraReader = new StringReader(this.extraFields[0x0001].value);

          // I really hope that these 64bits integer can fit in 32 bits integer, because js
          // won't let us have more.
          if (this.uncompressedSize === utils.MAX_VALUE_32BITS) {
            this.uncompressedSize = extraReader.readInt(8);
          }
          if (this.compressedSize === utils.MAX_VALUE_32BITS) {
            this.compressedSize = extraReader.readInt(8);
          }
          if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) {
            this.localHeaderOffset = extraReader.readInt(8);
          }
          if (this.diskNumberStart === utils.MAX_VALUE_32BITS) {
            this.diskNumberStart = extraReader.readInt(4);
          }
        },
        /**
         * Read the central part of a zip file and add the info in this object.
         * @param {DataReader} reader the reader to use.
         */
        readExtraFields: function (reader) {
          var start = reader.index,
            extraFieldId,
            extraFieldLength,
            extraFieldValue;

          this.extraFields = this.extraFields || {};

          while (reader.index < start + this.extraFieldsLength) {
            extraFieldId = reader.readInt(2);
            extraFieldLength = reader.readInt(2);
            extraFieldValue = reader.readString(extraFieldLength);

            this.extraFields[extraFieldId] = {
              id: extraFieldId,
              length: extraFieldLength,
              value: extraFieldValue
            };
          }
        },
        /**
         * Apply an UTF8 transformation if needed.
         */
        handleUTF8: function () {
          if (this.useUTF8()) {
            this.fileName = jszipProto.utf8decode(this.fileName);
            this.fileComment = jszipProto.utf8decode(this.fileComment);
          }
        }
      };
      module.exports = ZipEntry;

    }, {
      "./compressedObject": 19,
      "./object": 29,
      "./stringReader": 31,
      "./utils": 34
    }],
    37: [function (require, module, exports) {
      'use strict';
      var immediate = require('immediate');

      /* istanbul ignore next */
      function INTERNAL() {}

      var handlers = {};

      var REJECTED = ['REJECTED'];
      var FULFILLED = ['FULFILLED'];
      var PENDING = ['PENDING'];

      module.exports = Promise;

      function Promise(resolver) {
        if (typeof resolver !== 'function') {
          throw new TypeError('resolver must be a function');
        }
        this.state = PENDING;
        this.queue = [];
        this.outcome = void 0;
        if (resolver !== INTERNAL) {
          safelyResolveThenable(this, resolver);
        }
      }

      Promise.prototype["finally"] = function (callback) {
        if (typeof callback !== 'function') {
          return this;
        }
        var p = this.constructor;
        return this.then(resolve, reject);

        function resolve(value) {
          function yes() {
            return value;
          }
          return p.resolve(callback()).then(yes);
        }

        function reject(reason) {
          function no() {
            throw reason;
          }
          return p.resolve(callback()).then(no);
        }
      };
      Promise.prototype["catch"] = function (onRejected) {
        return this.then(null, onRejected);
      };
      Promise.prototype.then = function (onFulfilled, onRejected) {
        if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
          typeof onRejected !== 'function' && this.state === REJECTED) {
          return this;
        }
        var promise = new this.constructor(INTERNAL);
        if (this.state !== PENDING) {
          var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
          unwrap(promise, resolver, this.outcome);
        } else {
          this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
        }

        return promise;
      };

      function QueueItem(promise, onFulfilled, onRejected) {
        this.promise = promise;
        if (typeof onFulfilled === 'function') {
          this.onFulfilled = onFulfilled;
          this.callFulfilled = this.otherCallFulfilled;
        }
        if (typeof onRejected === 'function') {
          this.onRejected = onRejected;
          this.callRejected = this.otherCallRejected;
        }
      }
      QueueItem.prototype.callFulfilled = function (value) {
        handlers.resolve(this.promise, value);
      };
      QueueItem.prototype.otherCallFulfilled = function (value) {
        unwrap(this.promise, this.onFulfilled, value);
      };
      QueueItem.prototype.callRejected = function (value) {
        handlers.reject(this.promise, value);
      };
      QueueItem.prototype.otherCallRejected = function (value) {
        unwrap(this.promise, this.onRejected, value);
      };

      function unwrap(promise, func, value) {
        immediate(function () {
          var returnValue;
          try {
            returnValue = func(value);
          } catch (e) {
            return handlers.reject(promise, e);
          }
          if (returnValue === promise) {
            handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
          } else {
            handlers.resolve(promise, returnValue);
          }
        });
      }

      handlers.resolve = function (self, value) {
        var result = tryCatch(getThen, value);
        if (result.status === 'error') {
          return handlers.reject(self, result.value);
        }
        var thenable = result.value;

        if (thenable) {
          safelyResolveThenable(self, thenable);
        } else {
          self.state = FULFILLED;
          self.outcome = value;
          var i = -1;
          var len = self.queue.length;
          while (++i < len) {
            self.queue[i].callFulfilled(value);
          }
        }
        return self;
      };
      handlers.reject = function (self, error) {
        self.state = REJECTED;
        self.outcome = error;
        var i = -1;
        var len = self.queue.length;
        while (++i < len) {
          self.queue[i].callRejected(error);
        }
        return self;
      };

      function getThen(obj) {
        // Make sure we only access the accessor once as required by the spec
        var then = obj && obj.then;
        if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
          return function appyThen() {
            then.apply(obj, arguments);
          };
        }
      }

      function safelyResolveThenable(self, thenable) {
        // Either fulfill, reject or reject with error
        var called = false;

        function onError(value) {
          if (called) {
            return;
          }
          called = true;
          handlers.reject(self, value);
        }

        function onSuccess(value) {
          if (called) {
            return;
          }
          called = true;
          handlers.resolve(self, value);
        }

        function tryToUnwrap() {
          thenable(onSuccess, onError);
        }

        var result = tryCatch(tryToUnwrap);
        if (result.status === 'error') {
          onError(result.value);
        }
      }

      function tryCatch(func, value) {
        var out = {};
        try {
          out.value = func(value);
          out.status = 'success';
        } catch (e) {
          out.status = 'error';
          out.value = e;
        }
        return out;
      }

      Promise.resolve = resolve;

      function resolve(value) {
        if (value instanceof this) {
          return value;
        }
        return handlers.resolve(new this(INTERNAL), value);
      }

      Promise.reject = reject;

      function reject(reason) {
        var promise = new this(INTERNAL);
        return handlers.reject(promise, reason);
      }

      Promise.all = all;

      function all(iterable) {
        var self = this;
        if (Object.prototype.toString.call(iterable) !== '[object Array]') {
          return this.reject(new TypeError('must be an array'));
        }

        var len = iterable.length;
        var called = false;
        if (!len) {
          return this.resolve([]);
        }

        var values = new Array(len);
        var resolved = 0;
        var i = -1;
        var promise = new this(INTERNAL);

        while (++i < len) {
          allResolver(iterable[i], i);
        }
        return promise;

        function allResolver(value, i) {
          self.resolve(value).then(resolveFromAll, function (error) {
            if (!called) {
              called = true;
              handlers.reject(promise, error);
            }
          });

          function resolveFromAll(outValue) {
            values[i] = outValue;
            if (++resolved === len && !called) {
              called = true;
              handlers.resolve(promise, values);
            }
          }
        }
      }

      Promise.race = race;

      function race(iterable) {
        var self = this;
        if (Object.prototype.toString.call(iterable) !== '[object Array]') {
          return this.reject(new TypeError('must be an array'));
        }

        var len = iterable.length;
        var called = false;
        if (!len) {
          return this.resolve([]);
        }

        var i = -1;
        var promise = new this(INTERNAL);

        while (++i < len) {
          resolver(iterable[i]);
        }
        return promise;

        function resolver(value) {
          self.resolve(value).then(function (response) {
            if (!called) {
              called = true;
              handlers.resolve(promise, response);
            }
          }, function (error) {
            if (!called) {
              called = true;
              handlers.reject(promise, error);
            }
          });
        }
      }

    }, {
      "immediate": 17
    }],
    38: [function (require, module, exports) {
      /*
       Copyright 2013 Daniel Wirtz <dcode@dcode.io>
       Copyright 2009 The Closure Library Authors. All Rights Reserved.

       Licensed under the Apache License, Version 2.0 (the "License");
       you may not use this file except in compliance with the License.
       You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing, software
       distributed under the License is distributed on an "AS-IS" BASIS,
       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
       See the License for the specific language governing permissions and
       limitations under the License.
       */
      /**
       * @license Long.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
       * Released under the Apache License, Version 2.0
       * Derived from goog.math.Long from the Closure Library
       * see: https://github.com/dcodeIO/Long.js for details
       */
      (function (global) {
        "use strict";

        /**
         * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
         * values as *signed* integers.  See the from* functions below for more
         * convenient ways of constructing Longs.
         *
         * The internal representation of a long is the two given signed, 32-bit values.
         * We use 32-bit pieces because these are the size of integers on which
         * Javascript performs bit-operations.  For operations like addition and
         * multiplication, we split each number into 16-bit pieces, which can easily be
         * multiplied within Javascript's floating-point representation without overflow
         * or change in sign.
         *
         * In the algorithms below, we frequently reduce the negative case to the
         * positive case by negating the input(s) and then post-processing the result.
         * Note that we must ALWAYS check specially whether those values are MIN_VALUE
         * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
         * a positive number, it overflows back into a negative).  Not handling this
         * case would often result in infinite recursion.
         * 
         * @exports Long
         * @class A Long class for representing a 64-bit two's-complement integer value.
         * @param {number|!{low: number, high: number, unsigned: boolean}} low The low (signed) 32 bits of the long.
         *  Optionally accepts a Long-like object as the first parameter.
         * @param {number=} high The high (signed) 32 bits of the long.
         * @param {boolean=} unsigned Whether unsigned or not. Defaults to `false` (signed).
         * @constructor
         */
        var Long = function (low, high, unsigned) {
          if (low && typeof low === 'object') {
            high = low.high;
            unsigned = low.unsigned;
            low = low.low;
          }

          /**
           * The low 32 bits as a signed value.
           * @type {number}
           * @expose
           */
          this.low = low | 0;

          /**
           * The high 32 bits as a signed value.
           * @type {number}
           * @expose
           */
          this.high = high | 0;

          /**
           * Whether unsigned or not.
           * @type {boolean}
           * @expose
           */
          this.unsigned = !!unsigned;
        };

        // NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the from* methods on which they depend.

        // NOTE: The following cache variables are used internally only and are therefore not exposed as properties of the
        // Long class.

        /**
         * A cache of the Long representations of small integer values.
         * @type {!Object}
         */
        var INT_CACHE = {};

        /**
         * A cache of the Long representations of small unsigned integer values.
         * @type {!Object}
         */
        var UINT_CACHE = {};

        /**
         * Returns a Long representing the given (32-bit) integer value.
         * @param {number} value The 32-bit integer in question.
         * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
         * @return {!Long} The corresponding Long value.
         * @expose
         */
        Long.fromInt = function (value, unsigned) {
          var obj, cachedObj;
          if (!unsigned) {
            value = value | 0;
            if (-128 <= value && value < 128) {
              cachedObj = INT_CACHE[value];
              if (cachedObj) return cachedObj;
            }
            obj = new Long(value, value < 0 ? -1 : 0, false);
            if (-128 <= value && value < 128) {
              INT_CACHE[value] = obj;
            }
            return obj;
          } else {
            value = value >>> 0;
            if (0 <= value && value < 256) {
              cachedObj = UINT_CACHE[value];
              if (cachedObj) return cachedObj;
            }
            obj = new Long(value, (value | 0) < 0 ? -1 : 0, true);
            if (0 <= value && value < 256) {
              UINT_CACHE[value] = obj;
            }
            return obj;
          }
        };

        /**
         * Returns a Long representing the given value, provided that it is a finite
         * number.  Otherwise, zero is returned.
         * @param {number} value The number in question.
         * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
         * @return {!Long} The corresponding Long value.
         * @expose
         */
        Long.fromNumber = function (value, unsigned) {
          unsigned = !!unsigned;
          if (isNaN(value) || !isFinite(value)) {
            return Long.ZERO;
          } else if (!unsigned && value <= -TWO_PWR_63_DBL) {
            return Long.MIN_SIGNED_VALUE;
          } else if (unsigned && value <= 0) {
            return Long.MIN_UNSIGNED_VALUE;
          } else if (!unsigned && value + 1 >= TWO_PWR_63_DBL) {
            return Long.MAX_SIGNED_VALUE;
          } else if (unsigned && value >= TWO_PWR_64_DBL) {
            return Long.MAX_UNSIGNED_VALUE;
          } else if (value < 0) {
            return Long.fromNumber(-value, false).negate();
          } else {
            return new Long((value % TWO_PWR_32_DBL) | 0, (value / TWO_PWR_32_DBL) | 0, unsigned);
          }
        };

        /**
         * Returns a Long representing the 64bit integer that comes by concatenating the given low and high bits. Each is
         *  assumed to use 32 bits.
         * @param {number} lowBits The low 32 bits.
         * @param {number} highBits The high 32 bits.
         * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
         * @return {!Long} The corresponding Long value.
         * @expose
         */
        Long.fromBits = function (lowBits, highBits, unsigned) {
          return new Long(lowBits, highBits, unsigned);
        };

        /**
         * Returns a Long representing the 64bit integer that comes by concatenating the given low, middle and high bits.
         *  Each is assumed to use 28 bits.
         * @param {number} part0 The low 28 bits
         * @param {number} part1 The middle 28 bits
         * @param {number} part2 The high 28 (8) bits
         * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
         * @return {!Long}
         * @expose
         */
        Long.from28Bits = function (part0, part1, part2, unsigned) {
          // 00000000000000000000000000001111 11111111111111111111111122222222 2222222222222
          // LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
          return Long.fromBits(part0 | (part1 << 28), (part1 >>> 4) | (part2) << 24, unsigned);
        };

        /**
         * Returns a Long representation of the given string, written using the given
         * radix.
         * @param {string} str The textual representation of the Long.
         * @param {(boolean|number)=} unsigned Whether unsigned or not. Defaults to false (signed).
         * @param {number=} radix The radix in which the text is written.
         * @return {!Long} The corresponding Long value.
         * @expose
         */
        Long.fromString = function (str, unsigned, radix) {
          if (str.length == 0) {
            throw (new Error('number format error: empty string'));
          }
          if (str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity") {
            return Long.ZERO;
          }
          if (typeof unsigned === 'number') { // For goog.math.Long compatibility
            radix = unsigned;
            unsigned = false;
          }
          radix = radix || 10;
          if (radix < 2 || 36 < radix) {
            throw (new Error('radix out of range: ' + radix));
          }

          if (str.charAt(0) == '-') {
            return Long.fromString(str.substring(1), unsigned, radix).negate();
          } else if (str.indexOf('-') >= 0) {
            throw (new Error('number format error: interior "-" character: ' + str));
          }

          // Do several (8) digits each time through the loop, so as to
          // minimize the calls to the very expensive emulated div.
          var radixToPower = Long.fromNumber(Math.pow(radix, 8));

          var result = Long.ZERO;
          for (var i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i);
            var value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
              var power = Long.fromNumber(Math.pow(radix, size));
              result = result.multiply(power).add(Long.fromNumber(value));
            } else {
              result = result.multiply(radixToPower);
              result = result.add(Long.fromNumber(value));
            }
          }
          result.unsigned = unsigned;
          return result;
        };

        // NOTE: the compiler should inline these constant values below and then remove these variables, so there should be
        // no runtime penalty for these.

        // NOTE: The following constant values are used internally only and are therefore not exposed as properties of the
        // Long class.

        /**
         * @type {number}
         */
        var TWO_PWR_16_DBL = 1 << 16;

        /**
         * @type {number}
         */
        var TWO_PWR_24_DBL = 1 << 24;

        /**
         * @type {number}
         */
        var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;

        /**
         * @type {number}
         */
        var TWO_PWR_31_DBL = TWO_PWR_32_DBL / 2;

        /**
         * @type {number}
         */
        var TWO_PWR_48_DBL = TWO_PWR_32_DBL * TWO_PWR_16_DBL;

        /**
         * @type {number}
         */
        var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;

        /**
         * @type {number}
         */
        var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;

        /**
         * @type {!Long}
         */
        var TWO_PWR_24 = Long.fromInt(1 << 24);

        /**
         * @type {!Long}
         * @expose
         */
        Long.ZERO = Long.fromInt(0);

        /**
         * @type {!Long}
         * @expose
         */
        Long.UZERO = Long.fromInt(0, true);

        /**
         * @type {!Long}
         * @expose
         */
        Long.ONE = Long.fromInt(1);

        /**
         * @type {!Long}
         * @expose
         */
        Long.UONE = Long.fromInt(1, true);

        /**
         * @type {!Long}
         * @expose
         */
        Long.NEG_ONE = Long.fromInt(-1);

        /**
         * @type {!Long}
         * @expose
         */
        Long.MAX_SIGNED_VALUE = Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0, false);

        /**
         * @type {!Long}
         * @expose
         */
        Long.MAX_UNSIGNED_VALUE = Long.fromBits(0xFFFFFFFF | 0, 0xFFFFFFFF | 0, true);

        /**
         * Alias of {@link Long.MAX_SIGNED_VALUE} for goog.math.Long compatibility.
         * @type {!Long}
         * @expose
         */
        Long.MAX_VALUE = Long.MAX_SIGNED_VALUE;

        /**
         * @type {!Long}
         * @expose
         */
        Long.MIN_SIGNED_VALUE = Long.fromBits(0, 0x80000000 | 0, false);

        /**
         * @type {!Long}
         * @expose
         */
        Long.MIN_UNSIGNED_VALUE = Long.fromBits(0, 0, true);

        /**
         * Alias of {@link Long.MIN_SIGNED_VALUE}  for goog.math.Long compatibility.
         * @type {!Long}
         * @expose
         */
        Long.MIN_VALUE = Long.MIN_SIGNED_VALUE;

        /**
         * @return {number} The value, assuming it is a 32-bit integer.
         * @expose
         */
        Long.prototype.toInt = function () {
          return this.unsigned ? this.low >>> 0 : this.low;
        };

        /**
         * @return {number} The closest floating-point representation to this value.
         * @expose
         */
        Long.prototype.toNumber = function () {
          if (this.unsigned) {
            return ((this.high >>> 0) * TWO_PWR_32_DBL) + (this.low >>> 0);
          }
          return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
        };

        /**
         * @param {number=} radix The radix in which the text should be written.
         * @return {string} The textual representation of this value.
         * @override
         * @expose
         */
        Long.prototype.toString = function (radix) {
          radix = radix || 10;
          if (radix < 2 || 36 < radix) {
            throw (new Error('radix out of range: ' + radix));
          }
          if (this.isZero()) {
            return '0';
          }
          var rem;
          if (this.isNegative()) { // Unsigned Longs are never negative
            if (this.equals(Long.MIN_SIGNED_VALUE)) {
              // We need to change the Long value before it can be negated, so we remove
              // the bottom-most digit in this base and then recurse to do the rest.
              var radixLong = Long.fromNumber(radix);
              var div = this.div(radixLong);
              rem = div.multiply(radixLong).subtract(this);
              return div.toString(radix) + rem.toInt().toString(radix);
            } else {
              return '-' + this.negate().toString(radix);
            }
          }

          // Do several (6) digits each time through the loop, so as to
          // minimize the calls to the very expensive emulated div.
          var radixToPower = Long.fromNumber(Math.pow(radix, 6));
          rem = this;
          var result = '';
          while (true) {
            var remDiv = rem.div(radixToPower);
            var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
            var digits = intval.toString(radix);
            rem = remDiv;
            if (rem.isZero()) {
              return digits + result;
            } else {
              while (digits.length < 6) {
                digits = '0' + digits;
              }
              result = '' + digits + result;
            }
          }
        };

        /**
         * @return {number} The high 32 bits as a signed value.
         * @expose
         */
        Long.prototype.getHighBits = function () {
          return this.high;
        };

        /**
         * @return {number} The high 32 bits as an unsigned value.
         * @expose
         */
        Long.prototype.getHighBitsUnsigned = function () {
          return this.high >>> 0;
        };

        /**
         * @return {number} The low 32 bits as a signed value.
         * @expose
         */
        Long.prototype.getLowBits = function () {
          return this.low;
        };

        /**
         * @return {number} The low 32 bits as an unsigned value.
         * @expose
         */
        Long.prototype.getLowBitsUnsigned = function () {
          return this.low >>> 0;
        };

        /**
         * @return {number} Returns the number of bits needed to represent the absolute
         *     value of this Long.
         * @expose
         */
        Long.prototype.getNumBitsAbs = function () {
          if (this.isNegative()) { // Unsigned Longs are never negative
            if (this.equals(Long.MIN_SIGNED_VALUE)) {
              return 64;
            } else {
              return this.negate().getNumBitsAbs();
            }
          } else {
            var val = this.high != 0 ? this.high : this.low;
            for (var bit = 31; bit > 0; bit--) {
              if ((val & (1 << bit)) != 0) {
                break;
              }
            }
            return this.high != 0 ? bit + 33 : bit + 1;
          }
        };

        /**
         * @return {boolean} Whether this value is zero.
         * @expose
         */
        Long.prototype.isZero = function () {
          return this.high == 0 && this.low == 0;
        };

        /**
         * @return {boolean} Whether this value is negative.
         * @expose
         */
        Long.prototype.isNegative = function () {
          return !this.unsigned && this.high < 0;
        };

        /**
         * @return {boolean} Whether this value is odd.
         * @expose
         */
        Long.prototype.isOdd = function () {
          return (this.low & 1) == 1;
        };

        /**
         * @return {boolean} Whether this value is even.
         */
        Long.prototype.isEven = function () {
          return (this.low & 1) == 0;
        };

        /**
         * @param {Long} other Long to compare against.
         * @return {boolean} Whether this Long equals the other.
         * @expose
         */
        Long.prototype.equals = function (other) {
          if (this.unsigned != other.unsigned && (this.high >>> 31) != (other.high >>> 31)) return false;
          return (this.high == other.high) && (this.low == other.low);
        };

        /**
         * @param {Long} other Long to compare against.
         * @return {boolean} Whether this Long does not equal the other.
         * @expose
         */
        Long.prototype.notEquals = function (other) {
          return !this.equals(other);
        };

        /**
         * @param {Long} other Long to compare against.
         * @return {boolean} Whether this Long is less than the other.
         * @expose
         */
        Long.prototype.lessThan = function (other) {
          return this.compare(other) < 0;
        };

        /**
         * @param {Long} other Long to compare against.
         * @return {boolean} Whether this Long is less than or equal to the other.
         * @expose
         */
        Long.prototype.lessThanOrEqual = function (other) {
          return this.compare(other) <= 0;
        };

        /**
         * @param {Long} other Long to compare against.
         * @return {boolean} Whether this Long is greater than the other.
         * @expose
         */
        Long.prototype.greaterThan = function (other) {
          return this.compare(other) > 0;
        };

        /**
         * @param {Long} other Long to compare against.
         * @return {boolean} Whether this Long is greater than or equal to the other.
         * @expose
         */
        Long.prototype.greaterThanOrEqual = function (other) {
          return this.compare(other) >= 0;
        };

        /**
         * Compares this Long with the given one.
         * @param {Long} other Long to compare against.
         * @return {number} 0 if they are the same, 1 if the this is greater, and -1
         *     if the given one is greater.
         * @expose
         */
        Long.prototype.compare = function (other) {
          if (this.equals(other)) {
            return 0;
          }
          var thisNeg = this.isNegative();
          var otherNeg = other.isNegative();
          if (thisNeg && !otherNeg) return -1;
          if (!thisNeg && otherNeg) return 1;
          if (!this.unsigned) {
            // At this point the signs are the same
            return this.subtract(other).isNegative() ? -1 : 1;
          } else {
            // Both are positive if at least one is unsigned
            return (other.high >>> 0) > (this.high >>> 0) || (other.high == this.high && (other.low >>> 0) > (this.low >>> 0)) ? -1 : 1;
          }
        };

        /**
         * @return {!Long} The negation of this value.
         * @expose
         */
        Long.prototype.negate = function () {
          if (!this.unsigned && this.equals(Long.MIN_SIGNED_VALUE)) {
            return Long.MIN_SIGNED_VALUE;
          }
          return this.not().add(Long.ONE);
        };

        /**
         * Returns the sum of this and the given Long.
         * @param {Long} other Long to add to this one.
         * @return {!Long} The sum of this and the given Long.
         * @expose
         */
        Long.prototype.add = function (other) {
          // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

          var a48 = this.high >>> 16;
          var a32 = this.high & 0xFFFF;
          var a16 = this.low >>> 16;
          var a00 = this.low & 0xFFFF;

          var b48 = other.high >>> 16;
          var b32 = other.high & 0xFFFF;
          var b16 = other.low >>> 16;
          var b00 = other.low & 0xFFFF;

          var c48 = 0,
            c32 = 0,
            c16 = 0,
            c00 = 0;
          c00 += a00 + b00;
          c16 += c00 >>> 16;
          c00 &= 0xFFFF;
          c16 += a16 + b16;
          c32 += c16 >>> 16;
          c16 &= 0xFFFF;
          c32 += a32 + b32;
          c48 += c32 >>> 16;
          c32 &= 0xFFFF;
          c48 += a48 + b48;
          c48 &= 0xFFFF;
          return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
        };

        /**
         * Returns the difference of this and the given Long.
         * @param {Long} other Long to subtract from this.
         * @return {!Long} The difference of this and the given Long.
         * @expose
         */
        Long.prototype.subtract = function (other) {
          return this.add(other.negate());
        };

        /**
         * Returns the product of this and the given long.
         * @param {Long} other Long to multiply with this.
         * @return {!Long} The product of this and the other.
         * @expose
         */
        Long.prototype.multiply = function (other) {
          if (this.isZero()) {
            return Long.ZERO;
          } else if (other.isZero()) {
            return Long.ZERO;
          }

          if (this.equals(Long.MIN_VALUE)) {
            return other.isOdd() ? Long.MIN_VALUE : Long.ZERO;
          } else if (other.equals(Long.MIN_VALUE)) {
            return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;
          }

          if (this.isNegative()) {
            if (other.isNegative()) {
              return this.negate().multiply(other.negate());
            } else {
              return this.negate().multiply(other).negate();
            }
          } else if (other.isNegative()) {
            return this.multiply(other.negate()).negate();
          }
          // If both longs are small, use float multiplication
          if (this.lessThan(TWO_PWR_24) &&
            other.lessThan(TWO_PWR_24)) {
            return Long.fromNumber(this.toNumber() * other.toNumber(), this.unsigned);
          }

          // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
          // We can skip products that would overflow.

          var a48 = this.high >>> 16;
          var a32 = this.high & 0xFFFF;
          var a16 = this.low >>> 16;
          var a00 = this.low & 0xFFFF;

          var b48 = other.high >>> 16;
          var b32 = other.high & 0xFFFF;
          var b16 = other.low >>> 16;
          var b00 = other.low & 0xFFFF;

          var c48 = 0,
            c32 = 0,
            c16 = 0,
            c00 = 0;
          c00 += a00 * b00;
          c16 += c00 >>> 16;
          c00 &= 0xFFFF;
          c16 += a16 * b00;
          c32 += c16 >>> 16;
          c16 &= 0xFFFF;
          c16 += a00 * b16;
          c32 += c16 >>> 16;
          c16 &= 0xFFFF;
          c32 += a32 * b00;
          c48 += c32 >>> 16;
          c32 &= 0xFFFF;
          c32 += a16 * b16;
          c48 += c32 >>> 16;
          c32 &= 0xFFFF;
          c32 += a00 * b32;
          c48 += c32 >>> 16;
          c32 &= 0xFFFF;
          c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
          c48 &= 0xFFFF;
          return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
        };

        /**
         * Returns this Long divided by the given one.
         * @param {Long} other Long by which to divide.
         * @return {!Long} This Long divided by the given one.
         * @expose
         */
        Long.prototype.div = function (other) {
          if (other.isZero()) {
            throw (new Error('division by zero'));
          } else if (this.isZero()) {
            return this.unsigned ? Long.UZERO : Long.ZERO;
          }
          var approx, rem, res;
          if (this.equals(Long.MIN_SIGNED_VALUE)) {
            if (other.equals(Long.ONE) || other.equals(Long.NEG_ONE)) {
              return Long.MIN_SIGNED_VALUE; // recall that -MIN_VALUE == MIN_VALUE
            } else if (other.equals(Long.MIN_SIGNED_VALUE)) {
              return Long.ONE;
            } else {
              // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
              var halfThis = this.shiftRight(1);
              approx = halfThis.div(other).shiftLeft(1);
              if (approx.equals(Long.ZERO)) {
                return other.isNegative() ? Long.ONE : Long.NEG_ONE;
              } else {
                rem = this.subtract(other.multiply(approx));
                res = approx.add(rem.div(other));
                return res;
              }
            }
          } else if (other.equals(Long.MIN_SIGNED_VALUE)) {
            return this.unsigned ? Long.UZERO : Long.ZERO;
          }
          if (this.isNegative()) {
            if (other.isNegative()) {
              return this.negate().div(other.negate());
            } else {
              return this.negate().div(other).negate();
            }
          } else if (other.isNegative()) {
            return this.div(other.negate()).negate();
          }

          // Repeat the following until the remainder is less than other:  find a
          // floating-point that approximates remainder / other *from below*, add this
          // into the result, and subtract it from the remainder.  It is critical that
          // the approximate value is less than or equal to the real value so that the
          // remainder never becomes negative.
          res = Long.ZERO;
          rem = this;
          while (rem.greaterThanOrEqual(other)) {
            // Approximate the result of division. This may be a little greater or
            // smaller than the actual value.
            approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

            // We will tweak the approximate result by changing it in the 48-th digit or
            // the smallest non-fractional digit, whichever is larger.
            var log2 = Math.ceil(Math.log(approx) / Math.LN2);
            var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

            // Decrease the approximation until it is smaller than the remainder.  Note
            // that if it is too large, the product overflows and is negative.
            var approxRes = Long.fromNumber(approx, this.unsigned);
            var approxRem = approxRes.multiply(other);
            while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
              approx -= delta;
              approxRes = Long.fromNumber(approx, this.unsigned);
              approxRem = approxRes.multiply(other);
            }

            // We know the answer can't be zero... and actually, zero would cause
            // infinite recursion since we would make no progress.
            if (approxRes.isZero()) {
              approxRes = Long.ONE;
            }

            res = res.add(approxRes);
            rem = rem.subtract(approxRem);
          }
          return res;
        };

        /**
         * Returns this Long modulo the given one.
         * @param {Long} other Long by which to mod.
         * @return {!Long} This Long modulo the given one.
         * @expose
         */
        Long.prototype.modulo = function (other) {
          return this.subtract(this.div(other).multiply(other));
        };

        /**
         * @return {!Long} The bitwise-NOT of this value.
         * @expose
         */
        Long.prototype.not = function () {
          return Long.fromBits(~this.low, ~this.high, this.unsigned);
        };

        /**
         * Returns the bitwise-AND of this Long and the given one.
         * @param {Long} other The Long with which to AND.
         * @return {!Long} The bitwise-AND of this and the other.
         * @expose
         */
        Long.prototype.and = function (other) {
          return Long.fromBits(this.low & other.low, this.high & other.high, this.unsigned);
        };

        /**
         * Returns the bitwise-OR of this Long and the given one.
         * @param {Long} other The Long with which to OR.
         * @return {!Long} The bitwise-OR of this and the other.
         * @expose
         */
        Long.prototype.or = function (other) {
          return Long.fromBits(this.low | other.low, this.high | other.high, this.unsigned);
        };

        /**
         * Returns the bitwise-XOR of this Long and the given one.
         * @param {Long} other The Long with which to XOR.
         * @return {!Long} The bitwise-XOR of this and the other.
         * @expose
         */
        Long.prototype.xor = function (other) {
          return Long.fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
        };

        /**
         * Returns this Long with bits shifted to the left by the given amount.
         * @param {number} numBits The number of bits by which to shift.
         * @return {!Long} This shifted to the left by the given amount.
         * @expose
         */
        Long.prototype.shiftLeft = function (numBits) {
          numBits &= 63;
          if (numBits == 0) {
            return this;
          } else {
            var low = this.low;
            if (numBits < 32) {
              var high = this.high;
              return Long.fromBits(low << numBits, (high << numBits) | (low >>> (32 - numBits)), this.unsigned);
            } else {
              return Long.fromBits(0, low << (numBits - 32), this.unsigned);
            }
          }
        };

        /**
         * Returns this Long with bits shifted to the right by the given amount.
         * @param {number} numBits The number of bits by which to shift.
         * @return {!Long} This shifted to the right by the given amount.
         * @expose
         */
        Long.prototype.shiftRight = function (numBits) {
          numBits &= 63;
          if (numBits == 0) {
            return this;
          } else {
            var high = this.high;
            if (numBits < 32) {
              var low = this.low;
              return Long.fromBits((low >>> numBits) | (high << (32 - numBits)), high >> numBits, this.unsigned);
            } else {
              return Long.fromBits(high >> (numBits - 32), high >= 0 ? 0 : -1, this.unsigned);
            }
          }
        };

        /**
         * Returns this Long with bits shifted to the right by the given amount, with
         * the new top bits matching the current sign bit.
         * @param {number} numBits The number of bits by which to shift.
         * @return {!Long} This shifted to the right by the given amount, with
         *     zeros placed into the new leading bits.
         * @expose
         */
        Long.prototype.shiftRightUnsigned = function (numBits) {
          numBits &= 63;
          if (numBits == 0) {
            return this;
          } else {
            var high = this.high;
            if (numBits < 32) {
              var low = this.low;
              return Long.fromBits((low >>> numBits) | (high << (32 - numBits)), high >>> numBits, this.unsigned);
            } else if (numBits == 32) {
              return Long.fromBits(high, 0, this.unsigned);
            } else {
              return Long.fromBits(high >>> (numBits - 32), 0, this.unsigned);
            }
          }
        };

        /**
         * @return {!Long} Signed long
         * @expose
         */
        Long.prototype.toSigned = function () {
          var l = this.clone();
          l.unsigned = false;
          return l;
        };

        /**
         * @return {!Long} Unsigned long
         * @expose
         */
        Long.prototype.toUnsigned = function () {
          var l = this.clone();
          l.unsigned = true;
          return l;
        };

        /**
         * @return {Long} Cloned instance with the same low/high bits and unsigned flag.
         * @expose
         */
        Long.prototype.clone = function () {
          return new Long(this.low, this.high, this.unsigned);
        };

        // Enable module loading if available
        if (typeof module != 'undefined' && module["exports"]) { // CommonJS
          module["exports"] = Long;
        } else if (typeof define != 'undefined' && define["amd"]) { // AMD
          define("Math/Long", [], function () {
            return Long;
          });
        } else { // Shim
          if (!global["dcodeIO"]) {
            global["dcodeIO"] = {};
          }
          global["dcodeIO"]["Long"] = Long;
        }

      })(this);

    }, {}],
    39: [function (require, module, exports) {
      /*
       Copyright 2013 Daniel Wirtz <dcode@dcode.io>
       Copyright 2009 The Closure Library Authors. All Rights Reserved.

       Licensed under the Apache License, Version 2.0 (the "License");
       you may not use this file except in compliance with the License.
       You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing, software
       distributed under the License is distributed on an "AS-IS" BASIS,
       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
       See the License for the specific language governing permissions and
       limitations under the License.
       */

      module.exports = require("./dist/Long.js");

    }, {
      "./dist/Long.js": 38
    }],
    40: [function (require, module, exports) {
      // shim for using process in browser
      var process = module.exports = {};

      // cached from whatever global is present so that test runners that stub it
      // don't break things.  But we need to wrap it in a try catch in case it is
      // wrapped in strict mode code which doesn't define any globals.  It's inside a
      // function because try/catches deoptimize in certain engines.

      var cachedSetTimeout;
      var cachedClearTimeout;

      function defaultSetTimout() {
        throw new Error('setTimeout has not been defined');
      }

      function defaultClearTimeout() {
        throw new Error('clearTimeout has not been defined');
      }
      (function () {
        try {
          if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
          } else {
            cachedSetTimeout = defaultSetTimout;
          }
        } catch (e) {
          cachedSetTimeout = defaultSetTimout;
        }
        try {
          if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
          } else {
            cachedClearTimeout = defaultClearTimeout;
          }
        } catch (e) {
          cachedClearTimeout = defaultClearTimeout;
        }
      }())

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
        } catch (e) {
          try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
          } catch (e) {
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
        } catch (e) {
          try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
          } catch (e) {
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
        while (len) {
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

      process.nextTick = function (fun) {
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
      };

      // v8 likes predictible objects
      function Item(fun, array) {
        this.fun = fun;
        this.array = array;
      }
      Item.prototype.run = function () {
        this.fun.apply(null, this.array);
      };
      process.title = 'browser';
      process.browser = true;
      process.env = {};
      process.argv = [];
      process.version = ''; // empty string to avoid regexp issues
      process.versions = {};

      function noop() {}

      process.on = noop;
      process.addListener = noop;
      process.once = noop;
      process.off = noop;
      process.removeListener = noop;
      process.removeAllListeners = noop;
      process.emit = noop;
      process.prependListener = noop;
      process.prependOnceListener = noop;

      process.listeners = function (name) {
        return []
      }

      process.binding = function (name) {
        throw new Error('process.binding is not supported');
      };

      process.cwd = function () {
        return '/'
      };
      process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
      };
      process.umask = function () {
        return 0;
      };

    }, {}],
    41: [function (require, module, exports) {
      (function (global, factory) {
        typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
          typeof define === 'function' && define.amd ? define(factory) :
          (global.proj4 = factory());
      }(this, (function () {
        'use strict';

        var globals = function (defs) {
          defs('EPSG:4326', "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees");
          defs('EPSG:4269', "+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees");
          defs('EPSG:3857', "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs");

          defs.WGS84 = defs['EPSG:4326'];
          defs['EPSG:3785'] = defs['EPSG:3857']; // maintain backward compat, official code is 3857
          defs.GOOGLE = defs['EPSG:3857'];
          defs['EPSG:900913'] = defs['EPSG:3857'];
          defs['EPSG:102113'] = defs['EPSG:3857'];
        };

        var PJD_3PARAM = 1;
        var PJD_7PARAM = 2;
        var PJD_WGS84 = 4; // WGS84 or equivalent
        var PJD_NODATUM = 5; // WGS84 or equivalent
        var SEC_TO_RAD = 4.84813681109535993589914102357e-6;
        var HALF_PI = Math.PI / 2;
        // ellipoid pj_set_ell.c
        var SIXTH = 0.1666666666666666667;
        /* 1/6 */
        var RA4 = 0.04722222222222222222;
        /* 17/360 */
        var RA6 = 0.02215608465608465608;
        var EPSLN = 1.0e-10;
        // you'd think you could use Number.EPSILON above but that makes
        // Mollweide get into an infinate loop.

        var D2R = 0.01745329251994329577;
        var R2D = 57.29577951308232088;
        var FORTPI = Math.PI / 4;
        var TWO_PI = Math.PI * 2;
        // SPI is slightly greater than Math.PI, so values that exceed the -180..180
        // degree range by a tiny amount don't get wrapped. This prevents points that
        // have drifted from their original location along the 180th meridian (due to
        // floating point error) from changing their sign.
        var SPI = 3.14159265359;

        var exports$1 = {};
        exports$1.greenwich = 0.0; //"0dE",
        exports$1.lisbon = -9.131906111111; //"9d07'54.862\"W",
        exports$1.paris = 2.337229166667; //"2d20'14.025\"E",
        exports$1.bogota = -74.080916666667; //"74d04'51.3\"W",
        exports$1.madrid = -3.687938888889; //"3d41'16.58\"W",
        exports$1.rome = 12.452333333333; //"12d27'8.4\"E",
        exports$1.bern = 7.439583333333; //"7d26'22.5\"E",
        exports$1.jakarta = 106.807719444444; //"106d48'27.79\"E",
        exports$1.ferro = -17.666666666667; //"17d40'W",
        exports$1.brussels = 4.367975; //"4d22'4.71\"E",
        exports$1.stockholm = 18.058277777778; //"18d3'29.8\"E",
        exports$1.athens = 23.7163375; //"23d42'58.815\"E",
        exports$1.oslo = 10.722916666667; //"10d43'22.5\"E"

        var units = {
          ft: {
            to_meter: 0.3048
          },
          'us-ft': {
            to_meter: 1200 / 3937
          }
        };

        var ignoredChar = /[\s_\-\/\(\)]/g;

        function match(obj, key) {
          if (obj[key]) {
            return obj[key];
          }
          var keys = Object.keys(obj);
          var lkey = key.toLowerCase().replace(ignoredChar, '');
          var i = -1;
          var testkey, processedKey;
          while (++i < keys.length) {
            testkey = keys[i];
            processedKey = testkey.toLowerCase().replace(ignoredChar, '');
            if (processedKey === lkey) {
              return obj[testkey];
            }
          }
        }

        var parseProj = function (defData) {
          var self = {};
          var paramObj = defData.split('+').map(function (v) {
            return v.trim();
          }).filter(function (a) {
            return a;
          }).reduce(function (p, a) {
            var split = a.split('=');
            split.push(true);
            p[split[0].toLowerCase()] = split[1];
            return p;
          }, {});
          var paramName, paramVal, paramOutname;
          var params = {
            proj: 'projName',
            datum: 'datumCode',
            rf: function (v) {
              self.rf = parseFloat(v);
            },
            lat_0: function (v) {
              self.lat0 = v * D2R;
            },
            lat_1: function (v) {
              self.lat1 = v * D2R;
            },
            lat_2: function (v) {
              self.lat2 = v * D2R;
            },
            lat_ts: function (v) {
              self.lat_ts = v * D2R;
            },
            lon_0: function (v) {
              self.long0 = v * D2R;
            },
            lon_1: function (v) {
              self.long1 = v * D2R;
            },
            lon_2: function (v) {
              self.long2 = v * D2R;
            },
            alpha: function (v) {
              self.alpha = parseFloat(v) * D2R;
            },
            lonc: function (v) {
              self.longc = v * D2R;
            },
            x_0: function (v) {
              self.x0 = parseFloat(v);
            },
            y_0: function (v) {
              self.y0 = parseFloat(v);
            },
            k_0: function (v) {
              self.k0 = parseFloat(v);
            },
            k: function (v) {
              self.k0 = parseFloat(v);
            },
            a: function (v) {
              self.a = parseFloat(v);
            },
            b: function (v) {
              self.b = parseFloat(v);
            },
            r_a: function () {
              self.R_A = true;
            },
            zone: function (v) {
              self.zone = parseInt(v, 10);
            },
            south: function () {
              self.utmSouth = true;
            },
            towgs84: function (v) {
              self.datum_params = v.split(",").map(function (a) {
                return parseFloat(a);
              });
            },
            to_meter: function (v) {
              self.to_meter = parseFloat(v);
            },
            units: function (v) {
              self.units = v;
              var unit = match(units, v);
              if (unit) {
                self.to_meter = unit.to_meter;
              }
            },
            from_greenwich: function (v) {
              self.from_greenwich = v * D2R;
            },
            pm: function (v) {
              var pm = match(exports$1, v);
              self.from_greenwich = (pm ? pm : parseFloat(v)) * D2R;
            },
            nadgrids: function (v) {
              if (v === '@null') {
                self.datumCode = 'none';
              } else {
                self.nadgrids = v;
              }
            },
            axis: function (v) {
              var legalAxis = "ewnsud";
              if (v.length === 3 && legalAxis.indexOf(v.substr(0, 1)) !== -1 && legalAxis.indexOf(v.substr(1, 1)) !== -1 && legalAxis.indexOf(v.substr(2, 1)) !== -1) {
                self.axis = v;
              }
            }
          };
          for (paramName in paramObj) {
            paramVal = paramObj[paramName];
            if (paramName in params) {
              paramOutname = params[paramName];
              if (typeof paramOutname === 'function') {
                paramOutname(paramVal);
              } else {
                self[paramOutname] = paramVal;
              }
            } else {
              self[paramName] = paramVal;
            }
          }
          if (typeof self.datumCode === 'string' && self.datumCode !== "WGS84") {
            self.datumCode = self.datumCode.toLowerCase();
          }
          return self;
        };

        var NEUTRAL = 1;
        var KEYWORD = 2;
        var NUMBER = 3;
        var QUOTED = 4;
        var AFTERQUOTE = 5;
        var ENDED = -1;
        var whitespace = /\s/;
        var latin = /[A-Za-z]/;
        var keyword = /[A-Za-z84]/;
        var endThings = /[,\]]/;
        var digets = /[\d\.E\-\+]/;
        // const ignoredChar = /[\s_\-\/\(\)]/g;
        function Parser(text) {
          if (typeof text !== 'string') {
            throw new Error('not a string');
          }
          this.text = text.trim();
          this.level = 0;
          this.place = 0;
          this.root = null;
          this.stack = [];
          this.currentObject = null;
          this.state = NEUTRAL;
        }
        Parser.prototype.readCharicter = function () {
          var char = this.text[this.place++];
          if (this.state !== QUOTED) {
            while (whitespace.test(char)) {
              if (this.place >= this.text.length) {
                return;
              }
              char = this.text[this.place++];
            }
          }
          switch (this.state) {
            case NEUTRAL:
              return this.neutral(char);
            case KEYWORD:
              return this.keyword(char)
            case QUOTED:
              return this.quoted(char);
            case AFTERQUOTE:
              return this.afterquote(char);
            case NUMBER:
              return this.number(char);
            case ENDED:
              return;
          }
        };
        Parser.prototype.afterquote = function (char) {
          if (char === '"') {
            this.word += '"';
            this.state = QUOTED;
            return;
          }
          if (endThings.test(char)) {
            this.word = this.word.trim();
            this.afterItem(char);
            return;
          }
          throw new Error('havn\'t handled "' + char + '" in afterquote yet, index ' + this.place);
        };
        Parser.prototype.afterItem = function (char) {
          if (char === ',') {
            if (this.word !== null) {
              this.currentObject.push(this.word);
            }
            this.word = null;
            this.state = NEUTRAL;
            return;
          }
          if (char === ']') {
            this.level--;
            if (this.word !== null) {
              this.currentObject.push(this.word);
              this.word = null;
            }
            this.state = NEUTRAL;
            this.currentObject = this.stack.pop();
            if (!this.currentObject) {
              this.state = ENDED;
            }

            return;
          }
        };
        Parser.prototype.number = function (char) {
          if (digets.test(char)) {
            this.word += char;
            return;
          }
          if (endThings.test(char)) {
            this.word = parseFloat(this.word);
            this.afterItem(char);
            return;
          }
          throw new Error('havn\'t handled "' + char + '" in number yet, index ' + this.place);
        };
        Parser.prototype.quoted = function (char) {
          if (char === '"') {
            this.state = AFTERQUOTE;
            return;
          }
          this.word += char;
          return;
        };
        Parser.prototype.keyword = function (char) {
          if (keyword.test(char)) {
            this.word += char;
            return;
          }
          if (char === '[') {
            var newObjects = [];
            newObjects.push(this.word);
            this.level++;
            if (this.root === null) {
              this.root = newObjects;
            } else {
              this.currentObject.push(newObjects);
            }
            this.stack.push(this.currentObject);
            this.currentObject = newObjects;
            this.state = NEUTRAL;
            return;
          }
          if (endThings.test(char)) {
            this.afterItem(char);
            return;
          }
          throw new Error('havn\'t handled "' + char + '" in keyword yet, index ' + this.place);
        };
        Parser.prototype.neutral = function (char) {
          if (latin.test(char)) {
            this.word = char;
            this.state = KEYWORD;
            return;
          }
          if (char === '"') {
            this.word = '';
            this.state = QUOTED;
            return;
          }
          if (digets.test(char)) {
            this.word = char;
            this.state = NUMBER;
            return;
          }
          if (endThings.test(char)) {
            this.afterItem(char);
            return;
          }
          throw new Error('havn\'t handled "' + char + '" in neutral yet, index ' + this.place);
        };
        Parser.prototype.output = function () {
          while (this.place < this.text.length) {
            this.readCharicter();
          }
          if (this.state === ENDED) {
            return this.root;
          }
          throw new Error('unable to parse string "' + this.text + '". State is ' + this.state);
        };

        function parseString(txt) {
          var parser = new Parser(txt);
          return parser.output();
        }

        function mapit(obj, key, value) {
          if (Array.isArray(key)) {
            value.unshift(key);
            key = null;
          }
          var thing = key ? {} : obj;

          var out = value.reduce(function (newObj, item) {
            sExpr(item, newObj);
            return newObj
          }, thing);
          if (key) {
            obj[key] = out;
          }
        }

        function sExpr(v, obj) {
          if (!Array.isArray(v)) {
            obj[v] = true;
            return;
          }
          var key = v.shift();
          if (key === 'PARAMETER') {
            key = v.shift();
          }
          if (v.length === 1) {
            if (Array.isArray(v[0])) {
              obj[key] = {};
              sExpr(v[0], obj[key]);
              return;
            }
            obj[key] = v[0];
            return;
          }
          if (!v.length) {
            obj[key] = true;
            return;
          }
          if (key === 'TOWGS84') {
            obj[key] = v;
            return;
          }
          if (key === 'AXIS') {
            if (!(key in obj)) {
              obj[key] = [];
            }
            obj[key].push(v);
            return;
          }
          if (!Array.isArray(key)) {
            obj[key] = {};
          }

          var i;
          switch (key) {
            case 'UNIT':
            case 'PRIMEM':
            case 'VERT_DATUM':
              obj[key] = {
                name: v[0].toLowerCase(),
                convert: v[1]
              };
              if (v.length === 3) {
                sExpr(v[2], obj[key]);
              }
              return;
            case 'SPHEROID':
            case 'ELLIPSOID':
              obj[key] = {
                name: v[0],
                a: v[1],
                rf: v[2]
              };
              if (v.length === 4) {
                sExpr(v[3], obj[key]);
              }
              return;
            case 'PROJECTEDCRS':
            case 'PROJCRS':
            case 'GEOGCS':
            case 'GEOCCS':
            case 'PROJCS':
            case 'LOCAL_CS':
            case 'GEODCRS':
            case 'GEODETICCRS':
            case 'GEODETICDATUM':
            case 'EDATUM':
            case 'ENGINEERINGDATUM':
            case 'VERT_CS':
            case 'VERTCRS':
            case 'VERTICALCRS':
            case 'COMPD_CS':
            case 'COMPOUNDCRS':
            case 'ENGINEERINGCRS':
            case 'ENGCRS':
            case 'FITTED_CS':
            case 'LOCAL_DATUM':
            case 'DATUM':
              v[0] = ['name', v[0]];
              mapit(obj, key, v);
              return;
            default:
              i = -1;
              while (++i < v.length) {
                if (!Array.isArray(v[i])) {
                  return sExpr(v, obj[key]);
                }
              }
              return mapit(obj, key, v);
          }
        }

        var D2R$1 = 0.01745329251994329577;

        function rename(obj, params) {
          var outName = params[0];
          var inName = params[1];
          if (!(outName in obj) && (inName in obj)) {
            obj[outName] = obj[inName];
            if (params.length === 3) {
              obj[outName] = params[2](obj[outName]);
            }
          }
        }

        function d2r(input) {
          return input * D2R$1;
        }

        function cleanWKT(wkt) {
          if (wkt.type === 'GEOGCS') {
            wkt.projName = 'longlat';
          } else if (wkt.type === 'LOCAL_CS') {
            wkt.projName = 'identity';
            wkt.local = true;
          } else {
            if (typeof wkt.PROJECTION === 'object') {
              wkt.projName = Object.keys(wkt.PROJECTION)[0];
            } else {
              wkt.projName = wkt.PROJECTION;
            }
          }
          if (wkt.AXIS) {
            var axisOrder = '';
            for (var i = 0, ii = wkt.AXIS.length; i < ii; ++i) {
              var axis = wkt.AXIS[i];
              var descriptor = axis[0].toLowerCase();
              if (descriptor.indexOf('north') !== -1) {
                axisOrder += 'n';
              } else if (descriptor.indexOf('south') !== -1) {
                axisOrder += 's';
              } else if (descriptor.indexOf('east') !== -1) {
                axisOrder += 'e';
              } else if (descriptor.indexOf('west') !== -1) {
                axisOrder += 'w';
              }
            }
            if (axisOrder.length === 2) {
              axisOrder += 'u';
            }
            if (axisOrder.length === 3) {
              wkt.axis = axisOrder;
            }
          }
          if (wkt.UNIT) {
            wkt.units = wkt.UNIT.name.toLowerCase();
            if (wkt.units === 'metre') {
              wkt.units = 'meter';
            }
            if (wkt.UNIT.convert) {
              if (wkt.type === 'GEOGCS') {
                if (wkt.DATUM && wkt.DATUM.SPHEROID) {
                  wkt.to_meter = wkt.UNIT.convert * wkt.DATUM.SPHEROID.a;
                }
              } else {
                wkt.to_meter = wkt.UNIT.convert;
              }
            }
          }
          var geogcs = wkt.GEOGCS;
          if (wkt.type === 'GEOGCS') {
            geogcs = wkt;
          }
          if (geogcs) {
            //if(wkt.GEOGCS.PRIMEM&&wkt.GEOGCS.PRIMEM.convert){
            //  wkt.from_greenwich=wkt.GEOGCS.PRIMEM.convert*D2R;
            //}
            if (geogcs.DATUM) {
              wkt.datumCode = geogcs.DATUM.name.toLowerCase();
            } else {
              wkt.datumCode = geogcs.name.toLowerCase();
            }
            if (wkt.datumCode.slice(0, 2) === 'd_') {
              wkt.datumCode = wkt.datumCode.slice(2);
            }
            if (wkt.datumCode === 'new_zealand_geodetic_datum_1949' || wkt.datumCode === 'new_zealand_1949') {
              wkt.datumCode = 'nzgd49';
            }
            if (wkt.datumCode === 'wgs_1984' || wkt.datumCode === 'world_geodetic_system_1984') {
              if (wkt.PROJECTION === 'Mercator_Auxiliary_Sphere') {
                wkt.sphere = true;
              }
              wkt.datumCode = 'wgs84';
            }
            if (wkt.datumCode.slice(-6) === '_ferro') {
              wkt.datumCode = wkt.datumCode.slice(0, -6);
            }
            if (wkt.datumCode.slice(-8) === '_jakarta') {
              wkt.datumCode = wkt.datumCode.slice(0, -8);
            }
            if (~wkt.datumCode.indexOf('belge')) {
              wkt.datumCode = 'rnb72';
            }
            if (geogcs.DATUM && geogcs.DATUM.SPHEROID) {
              wkt.ellps = geogcs.DATUM.SPHEROID.name.replace('_19', '').replace(/[Cc]larke\_18/, 'clrk');
              if (wkt.ellps.toLowerCase().slice(0, 13) === 'international') {
                wkt.ellps = 'intl';
              }

              wkt.a = geogcs.DATUM.SPHEROID.a;
              wkt.rf = parseFloat(geogcs.DATUM.SPHEROID.rf, 10);
            }

            if (geogcs.DATUM && geogcs.DATUM.TOWGS84) {
              wkt.datum_params = geogcs.DATUM.TOWGS84;
            }
            if (~wkt.datumCode.indexOf('osgb_1936')) {
              wkt.datumCode = 'osgb36';
            }
            if (~wkt.datumCode.indexOf('osni_1952')) {
              wkt.datumCode = 'osni52';
            }
            if (~wkt.datumCode.indexOf('tm65') ||
              ~wkt.datumCode.indexOf('geodetic_datum_of_1965')) {
              wkt.datumCode = 'ire65';
            }
            if (wkt.datumCode === 'ch1903+') {
              wkt.datumCode = 'ch1903';
            }
            if (~wkt.datumCode.indexOf('israel')) {
              wkt.datumCode = 'isr93';
            }
          }
          if (wkt.b && !isFinite(wkt.b)) {
            wkt.b = wkt.a;
          }

          function toMeter(input) {
            var ratio = wkt.to_meter || 1;
            return input * ratio;
          }
          var renamer = function (a) {
            return rename(wkt, a);
          };
          var list = [
            ['standard_parallel_1', 'Standard_Parallel_1'],
            ['standard_parallel_2', 'Standard_Parallel_2'],
            ['false_easting', 'False_Easting'],
            ['false_northing', 'False_Northing'],
            ['central_meridian', 'Central_Meridian'],
            ['latitude_of_origin', 'Latitude_Of_Origin'],
            ['latitude_of_origin', 'Central_Parallel'],
            ['scale_factor', 'Scale_Factor'],
            ['k0', 'scale_factor'],
            ['latitude_of_center', 'Latitude_Of_Center'],
            ['latitude_of_center', 'Latitude_of_center'],
            ['lat0', 'latitude_of_center', d2r],
            ['longitude_of_center', 'Longitude_Of_Center'],
            ['longitude_of_center', 'Longitude_of_center'],
            ['longc', 'longitude_of_center', d2r],
            ['x0', 'false_easting', toMeter],
            ['y0', 'false_northing', toMeter],
            ['long0', 'central_meridian', d2r],
            ['lat0', 'latitude_of_origin', d2r],
            ['lat0', 'standard_parallel_1', d2r],
            ['lat1', 'standard_parallel_1', d2r],
            ['lat2', 'standard_parallel_2', d2r],
            ['azimuth', 'Azimuth'],
            ['alpha', 'azimuth', d2r],
            ['srsCode', 'name']
          ];
          list.forEach(renamer);
          if (!wkt.long0 && wkt.longc && (wkt.projName === 'Albers_Conic_Equal_Area' || wkt.projName === 'Lambert_Azimuthal_Equal_Area')) {
            wkt.long0 = wkt.longc;
          }
          if (!wkt.lat_ts && wkt.lat1 && (wkt.projName === 'Stereographic_South_Pole' || wkt.projName === 'Polar Stereographic (variant B)')) {
            wkt.lat0 = d2r(wkt.lat1 > 0 ? 90 : -90);
            wkt.lat_ts = wkt.lat1;
          }
        }
        var wkt = function (wkt) {
          var lisp = parseString(wkt);
          var type = lisp.shift();
          var name = lisp.shift();
          lisp.unshift(['name', name]);
          lisp.unshift(['type', type]);
          var obj = {};
          sExpr(lisp, obj);
          cleanWKT(obj);
          return obj;
        };

        function defs(name) {
          /*global console*/
          var that = this;
          if (arguments.length === 2) {
            var def = arguments[1];
            if (typeof def === 'string') {
              if (def.charAt(0) === '+') {
                defs[name] = parseProj(arguments[1]);
              } else {
                defs[name] = wkt(arguments[1]);
              }
            } else {
              defs[name] = def;
            }
          } else if (arguments.length === 1) {
            if (Array.isArray(name)) {
              return name.map(function (v) {
                if (Array.isArray(v)) {
                  defs.apply(that, v);
                } else {
                  defs(v);
                }
              });
            } else if (typeof name === 'string') {
              if (name in defs) {
                return defs[name];
              }
            } else if ('EPSG' in name) {
              defs['EPSG:' + name.EPSG] = name;
            } else if ('ESRI' in name) {
              defs['ESRI:' + name.ESRI] = name;
            } else if ('IAU2000' in name) {
              defs['IAU2000:' + name.IAU2000] = name;
            } else {
              console.log(name);
            }
            return;
          }


        }
        globals(defs);

        function testObj(code) {
          return typeof code === 'string';
        }

        function testDef(code) {
          return code in defs;
        }
        var codeWords = ['PROJECTEDCRS', 'PROJCRS', 'GEOGCS', 'GEOCCS', 'PROJCS', 'LOCAL_CS', 'GEODCRS', 'GEODETICCRS', 'GEODETICDATUM', 'ENGCRS', 'ENGINEERINGCRS'];

        function testWKT(code) {
          return codeWords.some(function (word) {
            return code.indexOf(word) > -1;
          });
        }
        var codes = ['3857', '900913', '3785', '102113'];

        function checkMercator(item) {
          var auth = match(item, 'authority');
          if (!auth) {
            return;
          }
          var code = match(auth, 'epsg');
          return code && codes.indexOf(code) > -1;
        }

        function checkProjStr(item) {
          var ext = match(item, 'extension');
          if (!ext) {
            return;
          }
          return match(ext, 'proj4');
        }

        function testProj(code) {
          return code[0] === '+';
        }

        function parse(code) {
          if (testObj(code)) {
            //check to see if this is a WKT string
            if (testDef(code)) {
              return defs[code];
            }
            if (testWKT(code)) {
              var out = wkt(code);
              // test of spetial case, due to this being a very common and often malformed
              if (checkMercator(out)) {
                return defs['EPSG:3857'];
              }
              var maybeProjStr = checkProjStr(out);
              if (maybeProjStr) {
                return parseProj(maybeProjStr);
              }
              return out;
            }
            if (testProj(code)) {
              return parseProj(code);
            }
          } else {
            return code;
          }
        }

        var extend = function (destination, source) {
          destination = destination || {};
          var value, property;
          if (!source) {
            return destination;
          }
          for (property in source) {
            value = source[property];
            if (value !== undefined) {
              destination[property] = value;
            }
          }
          return destination;
        };

        var msfnz = function (eccent, sinphi, cosphi) {
          var con = eccent * sinphi;
          return cosphi / (Math.sqrt(1 - con * con));
        };

        var sign = function (x) {
          return x < 0 ? -1 : 1;
        };

        var adjust_lon = function (x) {
          return (Math.abs(x) <= SPI) ? x : (x - (sign(x) * TWO_PI));
        };

        var tsfnz = function (eccent, phi, sinphi) {
          var con = eccent * sinphi;
          var com = 0.5 * eccent;
          con = Math.pow(((1 - con) / (1 + con)), com);
          return (Math.tan(0.5 * (HALF_PI - phi)) / con);
        };

        var phi2z = function (eccent, ts) {
          var eccnth = 0.5 * eccent;
          var con, dphi;
          var phi = HALF_PI - 2 * Math.atan(ts);
          for (var i = 0; i <= 15; i++) {
            con = eccent * Math.sin(phi);
            dphi = HALF_PI - 2 * Math.atan(ts * (Math.pow(((1 - con) / (1 + con)), eccnth))) - phi;
            phi += dphi;
            if (Math.abs(dphi) <= 0.0000000001) {
              return phi;
            }
          }
          //console.log("phi2z has NoConvergence");
          return -9999;
        };

        function init() {
          var con = this.b / this.a;
          this.es = 1 - con * con;
          if (!('x0' in this)) {
            this.x0 = 0;
          }
          if (!('y0' in this)) {
            this.y0 = 0;
          }
          this.e = Math.sqrt(this.es);
          if (this.lat_ts) {
            if (this.sphere) {
              this.k0 = Math.cos(this.lat_ts);
            } else {
              this.k0 = msfnz(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts));
            }
          } else {
            if (!this.k0) {
              if (this.k) {
                this.k0 = this.k;
              } else {
                this.k0 = 1;
              }
            }
          }
        }

        /* Mercator forward equations--mapping lat,long to x,y
          --------------------------------------------------*/

        function forward(p) {
          var lon = p.x;
          var lat = p.y;
          // convert to radians
          if (lat * R2D > 90 && lat * R2D < -90 && lon * R2D > 180 && lon * R2D < -180) {
            return null;
          }

          var x, y;
          if (Math.abs(Math.abs(lat) - HALF_PI) <= EPSLN) {
            return null;
          } else {
            if (this.sphere) {
              x = this.x0 + this.a * this.k0 * adjust_lon(lon - this.long0);
              y = this.y0 + this.a * this.k0 * Math.log(Math.tan(FORTPI + 0.5 * lat));
            } else {
              var sinphi = Math.sin(lat);
              var ts = tsfnz(this.e, lat, sinphi);
              x = this.x0 + this.a * this.k0 * adjust_lon(lon - this.long0);
              y = this.y0 - this.a * this.k0 * Math.log(ts);
            }
            p.x = x;
            p.y = y;
            return p;
          }
        }

        /* Mercator inverse equations--mapping x,y to lat/long
          --------------------------------------------------*/
        function inverse(p) {

          var x = p.x - this.x0;
          var y = p.y - this.y0;
          var lon, lat;

          if (this.sphere) {
            lat = HALF_PI - 2 * Math.atan(Math.exp(-y / (this.a * this.k0)));
          } else {
            var ts = Math.exp(-y / (this.a * this.k0));
            lat = phi2z(this.e, ts);
            if (lat === -9999) {
              return null;
            }
          }
          lon = adjust_lon(this.long0 + x / (this.a * this.k0));

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$1 = ["Mercator", "Popular Visualisation Pseudo Mercator", "Mercator_1SP", "Mercator_Auxiliary_Sphere", "merc"];
        var merc = {
          init: init,
          forward: forward,
          inverse: inverse,
          names: names$1
        };

        function init$1() {
          //no-op for longlat
        }

        function identity(pt) {
          return pt;
        }
        var names$2 = ["longlat", "identity"];
        var longlat = {
          init: init$1,
          forward: identity,
          inverse: identity,
          names: names$2
        };

        var projs = [merc, longlat];
        var names = {};
        var projStore = [];

        function add(proj, i) {
          var len = projStore.length;
          if (!proj.names) {
            console.log(i);
            return true;
          }
          projStore[len] = proj;
          proj.names.forEach(function (n) {
            names[n.toLowerCase()] = len;
          });
          return this;
        }

        function get(name) {
          if (!name) {
            return false;
          }
          var n = name.toLowerCase();
          if (typeof names[n] !== 'undefined' && projStore[names[n]]) {
            return projStore[names[n]];
          }
        }

        function start() {
          projs.forEach(add);
        }
        var projections = {
          start: start,
          add: add,
          get: get
        };

        var exports$2 = {};
        exports$2.MERIT = {
          a: 6378137.0,
          rf: 298.257,
          ellipseName: "MERIT 1983"
        };

        exports$2.SGS85 = {
          a: 6378136.0,
          rf: 298.257,
          ellipseName: "Soviet Geodetic System 85"
        };

        exports$2.GRS80 = {
          a: 6378137.0,
          rf: 298.257222101,
          ellipseName: "GRS 1980(IUGG, 1980)"
        };

        exports$2.IAU76 = {
          a: 6378140.0,
          rf: 298.257,
          ellipseName: "IAU 1976"
        };

        exports$2.airy = {
          a: 6377563.396,
          b: 6356256.910,
          ellipseName: "Airy 1830"
        };

        exports$2.APL4 = {
          a: 6378137,
          rf: 298.25,
          ellipseName: "Appl. Physics. 1965"
        };

        exports$2.NWL9D = {
          a: 6378145.0,
          rf: 298.25,
          ellipseName: "Naval Weapons Lab., 1965"
        };

        exports$2.mod_airy = {
          a: 6377340.189,
          b: 6356034.446,
          ellipseName: "Modified Airy"
        };

        exports$2.andrae = {
          a: 6377104.43,
          rf: 300.0,
          ellipseName: "Andrae 1876 (Den., Iclnd.)"
        };

        exports$2.aust_SA = {
          a: 6378160.0,
          rf: 298.25,
          ellipseName: "Australian Natl & S. Amer. 1969"
        };

        exports$2.GRS67 = {
          a: 6378160.0,
          rf: 298.2471674270,
          ellipseName: "GRS 67(IUGG 1967)"
        };

        exports$2.bessel = {
          a: 6377397.155,
          rf: 299.1528128,
          ellipseName: "Bessel 1841"
        };

        exports$2.bess_nam = {
          a: 6377483.865,
          rf: 299.1528128,
          ellipseName: "Bessel 1841 (Namibia)"
        };

        exports$2.clrk66 = {
          a: 6378206.4,
          b: 6356583.8,
          ellipseName: "Clarke 1866"
        };

        exports$2.clrk80 = {
          a: 6378249.145,
          rf: 293.4663,
          ellipseName: "Clarke 1880 mod."
        };

        exports$2.clrk58 = {
          a: 6378293.645208759,
          rf: 294.2606763692654,
          ellipseName: "Clarke 1858"
        };

        exports$2.CPM = {
          a: 6375738.7,
          rf: 334.29,
          ellipseName: "Comm. des Poids et Mesures 1799"
        };

        exports$2.delmbr = {
          a: 6376428.0,
          rf: 311.5,
          ellipseName: "Delambre 1810 (Belgium)"
        };

        exports$2.engelis = {
          a: 6378136.05,
          rf: 298.2566,
          ellipseName: "Engelis 1985"
        };

        exports$2.evrst30 = {
          a: 6377276.345,
          rf: 300.8017,
          ellipseName: "Everest 1830"
        };

        exports$2.evrst48 = {
          a: 6377304.063,
          rf: 300.8017,
          ellipseName: "Everest 1948"
        };

        exports$2.evrst56 = {
          a: 6377301.243,
          rf: 300.8017,
          ellipseName: "Everest 1956"
        };

        exports$2.evrst69 = {
          a: 6377295.664,
          rf: 300.8017,
          ellipseName: "Everest 1969"
        };

        exports$2.evrstSS = {
          a: 6377298.556,
          rf: 300.8017,
          ellipseName: "Everest (Sabah & Sarawak)"
        };

        exports$2.fschr60 = {
          a: 6378166.0,
          rf: 298.3,
          ellipseName: "Fischer (Mercury Datum) 1960"
        };

        exports$2.fschr60m = {
          a: 6378155.0,
          rf: 298.3,
          ellipseName: "Fischer 1960"
        };

        exports$2.fschr68 = {
          a: 6378150.0,
          rf: 298.3,
          ellipseName: "Fischer 1968"
        };

        exports$2.helmert = {
          a: 6378200.0,
          rf: 298.3,
          ellipseName: "Helmert 1906"
        };

        exports$2.hough = {
          a: 6378270.0,
          rf: 297.0,
          ellipseName: "Hough"
        };

        exports$2.intl = {
          a: 6378388.0,
          rf: 297.0,
          ellipseName: "International 1909 (Hayford)"
        };

        exports$2.kaula = {
          a: 6378163.0,
          rf: 298.24,
          ellipseName: "Kaula 1961"
        };

        exports$2.lerch = {
          a: 6378139.0,
          rf: 298.257,
          ellipseName: "Lerch 1979"
        };

        exports$2.mprts = {
          a: 6397300.0,
          rf: 191.0,
          ellipseName: "Maupertius 1738"
        };

        exports$2.new_intl = {
          a: 6378157.5,
          b: 6356772.2,
          ellipseName: "New International 1967"
        };

        exports$2.plessis = {
          a: 6376523.0,
          rf: 6355863.0,
          ellipseName: "Plessis 1817 (France)"
        };

        exports$2.krass = {
          a: 6378245.0,
          rf: 298.3,
          ellipseName: "Krassovsky, 1942"
        };

        exports$2.SEasia = {
          a: 6378155.0,
          b: 6356773.3205,
          ellipseName: "Southeast Asia"
        };

        exports$2.walbeck = {
          a: 6376896.0,
          b: 6355834.8467,
          ellipseName: "Walbeck"
        };

        exports$2.WGS60 = {
          a: 6378165.0,
          rf: 298.3,
          ellipseName: "WGS 60"
        };

        exports$2.WGS66 = {
          a: 6378145.0,
          rf: 298.25,
          ellipseName: "WGS 66"
        };

        exports$2.WGS7 = {
          a: 6378135.0,
          rf: 298.26,
          ellipseName: "WGS 72"
        };

        var WGS84 = exports$2.WGS84 = {
          a: 6378137.0,
          rf: 298.257223563,
          ellipseName: "WGS 84"
        };

        exports$2.sphere = {
          a: 6370997.0,
          b: 6370997.0,
          ellipseName: "Normal Sphere (r=6370997)"
        };

        function eccentricity(a, b, rf, R_A) {
          var a2 = a * a; // used in geocentric
          var b2 = b * b; // used in geocentric
          var es = (a2 - b2) / a2; // e ^ 2
          var e = 0;
          if (R_A) {
            a *= 1 - es * (SIXTH + es * (RA4 + es * RA6));
            a2 = a * a;
            es = 0;
          } else {
            e = Math.sqrt(es); // eccentricity
          }
          var ep2 = (a2 - b2) / b2; // used in geocentric
          return {
            es: es,
            e: e,
            ep2: ep2
          };
        }

        function sphere(a, b, rf, ellps, sphere) {
          if (!a) { // do we have an ellipsoid?
            var ellipse = match(exports$2, ellps);
            if (!ellipse) {
              ellipse = WGS84;
            }
            a = ellipse.a;
            b = ellipse.b;
            rf = ellipse.rf;
          }

          if (rf && !b) {
            b = (1.0 - 1.0 / rf) * a;
          }
          if (rf === 0 || Math.abs(a - b) < EPSLN) {
            sphere = true;
            b = a;
          }
          return {
            a: a,
            b: b,
            rf: rf,
            sphere: sphere
          };
        }

        var exports$3 = {};
        exports$3.wgs84 = {
          towgs84: "0,0,0",
          ellipse: "WGS84",
          datumName: "WGS84"
        };

        exports$3.ch1903 = {
          towgs84: "674.374,15.056,405.346",
          ellipse: "bessel",
          datumName: "swiss"
        };

        exports$3.ggrs87 = {
          towgs84: "-199.87,74.79,246.62",
          ellipse: "GRS80",
          datumName: "Greek_Geodetic_Reference_System_1987"
        };

        exports$3.nad83 = {
          towgs84: "0,0,0",
          ellipse: "GRS80",
          datumName: "North_American_Datum_1983"
        };

        exports$3.nad27 = {
          nadgrids: "@conus,@alaska,@ntv2_0.gsb,@ntv1_can.dat",
          ellipse: "clrk66",
          datumName: "North_American_Datum_1927"
        };

        exports$3.potsdam = {
          towgs84: "606.0,23.0,413.0",
          ellipse: "bessel",
          datumName: "Potsdam Rauenberg 1950 DHDN"
        };

        exports$3.carthage = {
          towgs84: "-263.0,6.0,431.0",
          ellipse: "clark80",
          datumName: "Carthage 1934 Tunisia"
        };

        exports$3.hermannskogel = {
          towgs84: "653.0,-212.0,449.0",
          ellipse: "bessel",
          datumName: "Hermannskogel"
        };

        exports$3.osni52 = {
          towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
          ellipse: "airy",
          datumName: "Irish National"
        };

        exports$3.ire65 = {
          towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
          ellipse: "mod_airy",
          datumName: "Ireland 1965"
        };

        exports$3.rassadiran = {
          towgs84: "-133.63,-157.5,-158.62",
          ellipse: "intl",
          datumName: "Rassadiran"
        };

        exports$3.nzgd49 = {
          towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993",
          ellipse: "intl",
          datumName: "New Zealand Geodetic Datum 1949"
        };

        exports$3.osgb36 = {
          towgs84: "446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894",
          ellipse: "airy",
          datumName: "Airy 1830"
        };

        exports$3.s_jtsk = {
          towgs84: "589,76,480",
          ellipse: 'bessel',
          datumName: 'S-JTSK (Ferro)'
        };

        exports$3.beduaram = {
          towgs84: '-106,-87,188',
          ellipse: 'clrk80',
          datumName: 'Beduaram'
        };

        exports$3.gunung_segara = {
          towgs84: '-403,684,41',
          ellipse: 'bessel',
          datumName: 'Gunung Segara Jakarta'
        };

        exports$3.rnb72 = {
          towgs84: "106.869,-52.2978,103.724,-0.33657,0.456955,-1.84218,1",
          ellipse: "intl",
          datumName: "Reseau National Belge 1972"
        };

        function datum(datumCode, datum_params, a, b, es, ep2) {
          var out = {};

          if (datumCode === undefined || datumCode === 'none') {
            out.datum_type = PJD_NODATUM;
          } else {
            out.datum_type = PJD_WGS84;
          }

          if (datum_params) {
            out.datum_params = datum_params.map(parseFloat);
            if (out.datum_params[0] !== 0 || out.datum_params[1] !== 0 || out.datum_params[2] !== 0) {
              out.datum_type = PJD_3PARAM;
            }
            if (out.datum_params.length > 3) {
              if (out.datum_params[3] !== 0 || out.datum_params[4] !== 0 || out.datum_params[5] !== 0 || out.datum_params[6] !== 0) {
                out.datum_type = PJD_7PARAM;
                out.datum_params[3] *= SEC_TO_RAD;
                out.datum_params[4] *= SEC_TO_RAD;
                out.datum_params[5] *= SEC_TO_RAD;
                out.datum_params[6] = (out.datum_params[6] / 1000000.0) + 1.0;
              }
            }
          }

          out.a = a; //datum object also uses these values
          out.b = b;
          out.es = es;
          out.ep2 = ep2;
          return out;
        }

        function Projection(srsCode, callback) {
          if (!(this instanceof Projection)) {
            return new Projection(srsCode);
          }
          callback = callback || function (error) {
            if (error) {
              throw error;
            }
          };
          var json = parse(srsCode);
          if (typeof json !== 'object') {
            callback(srsCode);
            return;
          }
          var ourProj = Projection.projections.get(json.projName);
          if (!ourProj) {
            callback(srsCode);
            return;
          }
          if (json.datumCode && json.datumCode !== 'none') {
            var datumDef = match(exports$3, json.datumCode);
            if (datumDef) {
              json.datum_params = datumDef.towgs84 ? datumDef.towgs84.split(',') : null;
              json.ellps = datumDef.ellipse;
              json.datumName = datumDef.datumName ? datumDef.datumName : json.datumCode;
            }
          }
          json.k0 = json.k0 || 1.0;
          json.axis = json.axis || 'enu';
          json.ellps = json.ellps || 'wgs84';
          var sphere_ = sphere(json.a, json.b, json.rf, json.ellps, json.sphere);
          var ecc = eccentricity(sphere_.a, sphere_.b, sphere_.rf, json.R_A);
          var datumObj = json.datum || datum(json.datumCode, json.datum_params, sphere_.a, sphere_.b, ecc.es, ecc.ep2);

          extend(this, json); // transfer everything over from the projection because we don't know what we'll need
          extend(this, ourProj); // transfer all the methods from the projection

          // copy the 4 things over we calulated in deriveConstants.sphere
          this.a = sphere_.a;
          this.b = sphere_.b;
          this.rf = sphere_.rf;
          this.sphere = sphere_.sphere;

          // copy the 3 things we calculated in deriveConstants.eccentricity
          this.es = ecc.es;
          this.e = ecc.e;
          this.ep2 = ecc.ep2;

          // add in the datum object
          this.datum = datumObj;

          // init the projection
          this.init();

          // legecy callback from back in the day when it went to spatialreference.org
          callback(null, this);

        }
        Projection.projections = projections;
        Projection.projections.start();

        'use strict';

        function compareDatums(source, dest) {
          if (source.datum_type !== dest.datum_type) {
            return false; // false, datums are not equal
          } else if (source.a !== dest.a || Math.abs(source.es - dest.es) > 0.000000000050) {
            // the tolerance for es is to ensure that GRS80 and WGS84
            // are considered identical
            return false;
          } else if (source.datum_type === PJD_3PARAM) {
            return (source.datum_params[0] === dest.datum_params[0] && source.datum_params[1] === dest.datum_params[1] && source.datum_params[2] === dest.datum_params[2]);
          } else if (source.datum_type === PJD_7PARAM) {
            return (source.datum_params[0] === dest.datum_params[0] && source.datum_params[1] === dest.datum_params[1] && source.datum_params[2] === dest.datum_params[2] && source.datum_params[3] === dest.datum_params[3] && source.datum_params[4] === dest.datum_params[4] && source.datum_params[5] === dest.datum_params[5] && source.datum_params[6] === dest.datum_params[6]);
          } else {
            return true; // datums are equal
          }
        } // cs_compare_datums()

        /*
         * The function Convert_Geodetic_To_Geocentric converts geodetic coordinates
         * (latitude, longitude, and height) to geocentric coordinates (X, Y, Z),
         * according to the current ellipsoid parameters.
         *
         *    Latitude  : Geodetic latitude in radians                     (input)
         *    Longitude : Geodetic longitude in radians                    (input)
         *    Height    : Geodetic height, in meters                       (input)
         *    X         : Calculated Geocentric X coordinate, in meters    (output)
         *    Y         : Calculated Geocentric Y coordinate, in meters    (output)
         *    Z         : Calculated Geocentric Z coordinate, in meters    (output)
         *
         */
        function geodeticToGeocentric(p, es, a) {
          var Longitude = p.x;
          var Latitude = p.y;
          var Height = p.z ? p.z : 0; //Z value not always supplied

          var Rn; /*  Earth radius at location  */
          var Sin_Lat; /*  Math.sin(Latitude)  */
          var Sin2_Lat; /*  Square of Math.sin(Latitude)  */
          var Cos_Lat; /*  Math.cos(Latitude)  */

          /*
           ** Don't blow up if Latitude is just a little out of the value
           ** range as it may just be a rounding issue.  Also removed longitude
           ** test, it should be wrapped by Math.cos() and Math.sin().  NFW for PROJ.4, Sep/2001.
           */
          if (Latitude < -HALF_PI && Latitude > -1.001 * HALF_PI) {
            Latitude = -HALF_PI;
          } else if (Latitude > HALF_PI && Latitude < 1.001 * HALF_PI) {
            Latitude = HALF_PI;
          } else if (Latitude < -HALF_PI) {
            /* Latitude out of range */
            //..reportError('geocent:lat out of range:' + Latitude);
            return {
              x: -Infinity,
              y: -Infinity,
              z: p.z
            };
          } else if (Latitude > HALF_PI) {
            /* Latitude out of range */
            return {
              x: Infinity,
              y: Infinity,
              z: p.z
            };
          }

          if (Longitude > Math.PI) {
            Longitude -= (2 * Math.PI);
          }
          Sin_Lat = Math.sin(Latitude);
          Cos_Lat = Math.cos(Latitude);
          Sin2_Lat = Sin_Lat * Sin_Lat;
          Rn = a / (Math.sqrt(1.0e0 - es * Sin2_Lat));
          return {
            x: (Rn + Height) * Cos_Lat * Math.cos(Longitude),
            y: (Rn + Height) * Cos_Lat * Math.sin(Longitude),
            z: ((Rn * (1 - es)) + Height) * Sin_Lat
          };
        } // cs_geodetic_to_geocentric()

        function geocentricToGeodetic(p, es, a, b) {
          /* local defintions and variables */
          /* end-criterium of loop, accuracy of sin(Latitude) */
          var genau = 1e-12;
          var genau2 = (genau * genau);
          var maxiter = 30;

          var P; /* distance between semi-minor axis and location */
          var RR; /* distance between center and location */
          var CT; /* sin of geocentric latitude */
          var ST; /* cos of geocentric latitude */
          var RX;
          var RK;
          var RN; /* Earth radius at location */
          var CPHI0; /* cos of start or old geodetic latitude in iterations */
          var SPHI0; /* sin of start or old geodetic latitude in iterations */
          var CPHI; /* cos of searched geodetic latitude */
          var SPHI; /* sin of searched geodetic latitude */
          var SDPHI; /* end-criterium: addition-theorem of sin(Latitude(iter)-Latitude(iter-1)) */
          var iter; /* # of continous iteration, max. 30 is always enough (s.a.) */

          var X = p.x;
          var Y = p.y;
          var Z = p.z ? p.z : 0.0; //Z value not always supplied
          var Longitude;
          var Latitude;
          var Height;

          P = Math.sqrt(X * X + Y * Y);
          RR = Math.sqrt(X * X + Y * Y + Z * Z);

          /*      special cases for latitude and longitude */
          if (P / a < genau) {

            /*  special case, if P=0. (X=0., Y=0.) */
            Longitude = 0.0;

            /*  if (X,Y,Z)=(0.,0.,0.) then Height becomes semi-minor axis
             *  of ellipsoid (=center of mass), Latitude becomes PI/2 */
            if (RR / a < genau) {
              Latitude = HALF_PI;
              Height = -b;
              return {
                x: p.x,
                y: p.y,
                z: p.z
              };
            }
          } else {
            /*  ellipsoidal (geodetic) longitude
             *  interval: -PI < Longitude <= +PI */
            Longitude = Math.atan2(Y, X);
          }

          /* --------------------------------------------------------------
           * Following iterative algorithm was developped by
           * "Institut for Erdmessung", University of Hannover, July 1988.
           * Internet: www.ife.uni-hannover.de
           * Iterative computation of CPHI,SPHI and Height.
           * Iteration of CPHI and SPHI to 10**-12 radian resp.
           * 2*10**-7 arcsec.
           * --------------------------------------------------------------
           */
          CT = Z / RR;
          ST = P / RR;
          RX = 1.0 / Math.sqrt(1.0 - es * (2.0 - es) * ST * ST);
          CPHI0 = ST * (1.0 - es) * RX;
          SPHI0 = CT * RX;
          iter = 0;

          /* loop to find sin(Latitude) resp. Latitude
           * until |sin(Latitude(iter)-Latitude(iter-1))| < genau */
          do {
            iter++;
            RN = a / Math.sqrt(1.0 - es * SPHI0 * SPHI0);

            /*  ellipsoidal (geodetic) height */
            Height = P * CPHI0 + Z * SPHI0 - RN * (1.0 - es * SPHI0 * SPHI0);

            RK = es * RN / (RN + Height);
            RX = 1.0 / Math.sqrt(1.0 - RK * (2.0 - RK) * ST * ST);
            CPHI = ST * (1.0 - RK) * RX;
            SPHI = CT * RX;
            SDPHI = SPHI * CPHI0 - CPHI * SPHI0;
            CPHI0 = CPHI;
            SPHI0 = SPHI;
          }
          while (SDPHI * SDPHI > genau2 && iter < maxiter);

          /*      ellipsoidal (geodetic) latitude */
          Latitude = Math.atan(SPHI / Math.abs(CPHI));
          return {
            x: Longitude,
            y: Latitude,
            z: Height
          };
        } // cs_geocentric_to_geodetic()

        /****************************************************************/
        // pj_geocentic_to_wgs84( p )
        //  p = point to transform in geocentric coordinates (x,y,z)


        /** point object, nothing fancy, just allows values to be
            passed back and forth by reference rather than by value.
            Other point classes may be used as long as they have
            x and y properties, which will get modified in the transform method.
        */
        function geocentricToWgs84(p, datum_type, datum_params) {

          if (datum_type === PJD_3PARAM) {
            // if( x[io] === HUGE_VAL )
            //    continue;
            return {
              x: p.x + datum_params[0],
              y: p.y + datum_params[1],
              z: p.z + datum_params[2],
            };
          } else if (datum_type === PJD_7PARAM) {
            var Dx_BF = datum_params[0];
            var Dy_BF = datum_params[1];
            var Dz_BF = datum_params[2];
            var Rx_BF = datum_params[3];
            var Ry_BF = datum_params[4];
            var Rz_BF = datum_params[5];
            var M_BF = datum_params[6];
            // if( x[io] === HUGE_VAL )
            //    continue;
            return {
              x: M_BF * (p.x - Rz_BF * p.y + Ry_BF * p.z) + Dx_BF,
              y: M_BF * (Rz_BF * p.x + p.y - Rx_BF * p.z) + Dy_BF,
              z: M_BF * (-Ry_BF * p.x + Rx_BF * p.y + p.z) + Dz_BF
            };
          }
        } // cs_geocentric_to_wgs84

        /****************************************************************/
        // pj_geocentic_from_wgs84()
        //  coordinate system definition,
        //  point to transform in geocentric coordinates (x,y,z)
        function geocentricFromWgs84(p, datum_type, datum_params) {

          if (datum_type === PJD_3PARAM) {
            //if( x[io] === HUGE_VAL )
            //    continue;
            return {
              x: p.x - datum_params[0],
              y: p.y - datum_params[1],
              z: p.z - datum_params[2],
            };

          } else if (datum_type === PJD_7PARAM) {
            var Dx_BF = datum_params[0];
            var Dy_BF = datum_params[1];
            var Dz_BF = datum_params[2];
            var Rx_BF = datum_params[3];
            var Ry_BF = datum_params[4];
            var Rz_BF = datum_params[5];
            var M_BF = datum_params[6];
            var x_tmp = (p.x - Dx_BF) / M_BF;
            var y_tmp = (p.y - Dy_BF) / M_BF;
            var z_tmp = (p.z - Dz_BF) / M_BF;
            //if( x[io] === HUGE_VAL )
            //    continue;

            return {
              x: x_tmp + Rz_BF * y_tmp - Ry_BF * z_tmp,
              y: -Rz_BF * x_tmp + y_tmp + Rx_BF * z_tmp,
              z: Ry_BF * x_tmp - Rx_BF * y_tmp + z_tmp
            };
          } //cs_geocentric_from_wgs84()
        }

        function checkParams(type) {
          return (type === PJD_3PARAM || type === PJD_7PARAM);
        }

        var datum_transform = function (source, dest, point) {
          // Short cut if the datums are identical.
          if (compareDatums(source, dest)) {
            return point; // in this case, zero is sucess,
            // whereas cs_compare_datums returns 1 to indicate TRUE
            // confusing, should fix this
          }

          // Explicitly skip datum transform by setting 'datum=none' as parameter for either source or dest
          if (source.datum_type === PJD_NODATUM || dest.datum_type === PJD_NODATUM) {
            return point;
          }

          // If this datum requires grid shifts, then apply it to geodetic coordinates.

          // Do we need to go through geocentric coordinates?
          if (source.es === dest.es && source.a === dest.a && !checkParams(source.datum_type) && !checkParams(dest.datum_type)) {
            return point;
          }

          // Convert to geocentric coordinates.
          point = geodeticToGeocentric(point, source.es, source.a);
          // Convert between datums
          if (checkParams(source.datum_type)) {
            point = geocentricToWgs84(point, source.datum_type, source.datum_params);
          }
          if (checkParams(dest.datum_type)) {
            point = geocentricFromWgs84(point, dest.datum_type, dest.datum_params);
          }
          return geocentricToGeodetic(point, dest.es, dest.a, dest.b);

        };

        var adjust_axis = function (crs, denorm, point) {
          var xin = point.x,
            yin = point.y,
            zin = point.z || 0.0;
          var v, t, i;
          var out = {};
          for (i = 0; i < 3; i++) {
            if (denorm && i === 2 && point.z === undefined) {
              continue;
            }
            if (i === 0) {
              v = xin;
              if ("ew".indexOf(crs.axis[i]) !== -1) {
                t = 'x';
              } else {
                t = 'y';
              }

            } else if (i === 1) {
              v = yin;
              if ("ns".indexOf(crs.axis[i]) !== -1) {
                t = 'y';
              } else {
                t = 'x';
              }
            } else {
              v = zin;
              t = 'z';
            }
            switch (crs.axis[i]) {
              case 'e':
              case 'w':
              case 'n':
              case 's':
                out[t] = v;
                break;
              case 'u':
                if (point[t] !== undefined) {
                  out.z = v;
                }
                break;
              case 'd':
                if (point[t] !== undefined) {
                  out.z = -v;
                }
                break;
              default:
                //console.log("ERROR: unknow axis ("+crs.axis[i]+") - check definition of "+crs.projName);
                return null;
            }
          }
          return out;
        };

        var toPoint = function (array) {
          var out = {
            x: array[0],
            y: array[1]
          };
          if (array.length > 2) {
            out.z = array[2];
          }
          if (array.length > 3) {
            out.m = array[3];
          }
          return out;
        };

        var checkSanity = function (point) {
          checkCoord(point.x);
          checkCoord(point.y);
        };

        function checkCoord(num) {
          if (typeof Number.isFinite === 'function') {
            if (Number.isFinite(num)) {
              return;
            }
            throw new TypeError('coordinates must be finite numbers');
          }
          if (typeof num !== 'number' || num !== num || !isFinite(num)) {
            throw new TypeError('coordinates must be finite numbers');
          }
        }

        function checkNotWGS(source, dest) {
          return ((source.datum.datum_type === PJD_3PARAM || source.datum.datum_type === PJD_7PARAM) && dest.datumCode !== 'WGS84') || ((dest.datum.datum_type === PJD_3PARAM || dest.datum.datum_type === PJD_7PARAM) && source.datumCode !== 'WGS84');
        }

        function transform(source, dest, point) {
          var wgs84;
          if (Array.isArray(point)) {
            point = toPoint(point);
          }
          checkSanity(point);
          // Workaround for datum shifts towgs84, if either source or destination projection is not wgs84
          if (source.datum && dest.datum && checkNotWGS(source, dest)) {
            wgs84 = new Projection('WGS84');
            point = transform(source, wgs84, point);
            source = wgs84;
          }
          // DGR, 2010/11/12
          if (source.axis !== 'enu') {
            point = adjust_axis(source, false, point);
          }
          // Transform source points to long/lat, if they aren't already.
          if (source.projName === 'longlat') {
            point = {
              x: point.x * D2R,
              y: point.y * D2R,
              z: point.z || 0
            };
          } else {
            if (source.to_meter) {
              point = {
                x: point.x * source.to_meter,
                y: point.y * source.to_meter,
                z: point.z || 0
              };
            }
            point = source.inverse(point); // Convert Cartesian to longlat
          }
          // Adjust for the prime meridian if necessary
          if (source.from_greenwich) {
            point.x += source.from_greenwich;
          }

          // Convert datums if needed, and if possible.
          point = datum_transform(source.datum, dest.datum, point);

          // Adjust for the prime meridian if necessary
          if (dest.from_greenwich) {
            point = {
              x: point.x - dest.from_greenwich,
              y: point.y,
              z: point.z || 0
            };
          }

          if (dest.projName === 'longlat') {
            // convert radians to decimal degrees
            point = {
              x: point.x * R2D,
              y: point.y * R2D,
              z: point.z || 0
            };
          } else { // else project
            point = dest.forward(point);
            if (dest.to_meter) {
              point = {
                x: point.x / dest.to_meter,
                y: point.y / dest.to_meter,
                z: point.z || 0
              };
            }
          }

          // DGR, 2010/11/12
          if (dest.axis !== 'enu') {
            return adjust_axis(dest, true, point);
          }

          return point;
        }

        var wgs84 = Projection('WGS84');

        function transformer(from, to, coords) {
          var transformedArray, out, keys;
          if (Array.isArray(coords)) {
            transformedArray = transform(from, to, coords) || {
              x: NaN,
              y: NaN
            };
            if (coords.length > 2) {
              if ((typeof from.name !== 'undefined' && from.name === 'geocent') || (typeof to.name !== 'undefined' && to.name === 'geocent')) {
                if (typeof transformedArray.z === 'number') {
                  return [transformedArray.x, transformedArray.y, transformedArray.z].concat(coords.splice(3));
                } else {
                  return [transformedArray.x, transformedArray.y, coords[2]].concat(coords.splice(3));
                }
              } else {
                return [transformedArray.x, transformedArray.y].concat(coords.splice(2));
              }
            } else {
              return [transformedArray.x, transformedArray.y];
            }
          } else {
            out = transform(from, to, coords);
            keys = Object.keys(coords);
            if (keys.length === 2) {
              return out;
            }
            keys.forEach(function (key) {
              if ((typeof from.name !== 'undefined' && from.name === 'geocent') || (typeof to.name !== 'undefined' && to.name === 'geocent')) {
                if (key === 'x' || key === 'y' || key === 'z') {
                  return;
                }
              } else {
                if (key === 'x' || key === 'y') {
                  return;
                }
              }
              out[key] = coords[key];
            });
            return out;
          }
        }

        function checkProj(item) {
          if (item instanceof Projection) {
            return item;
          }
          if (item.oProj) {
            return item.oProj;
          }
          return Projection(item);
        }

        function proj4$1(fromProj, toProj, coord) {
          fromProj = checkProj(fromProj);
          var single = false;
          var obj;
          if (typeof toProj === 'undefined') {
            toProj = fromProj;
            fromProj = wgs84;
            single = true;
          } else if (typeof toProj.x !== 'undefined' || Array.isArray(toProj)) {
            coord = toProj;
            toProj = fromProj;
            fromProj = wgs84;
            single = true;
          }
          toProj = checkProj(toProj);
          if (coord) {
            return transformer(fromProj, toProj, coord);
          } else {
            obj = {
              forward: function (coords) {
                return transformer(fromProj, toProj, coords);
              },
              inverse: function (coords) {
                return transformer(toProj, fromProj, coords);
              }
            };
            if (single) {
              obj.oProj = toProj;
            }
            return obj;
          }
        }

        /**
         * UTM zones are grouped, and assigned to one of a group of 6
         * sets.
         *
         * {int} @private
         */
        var NUM_100K_SETS = 6;

        /**
         * The column letters (for easting) of the lower left value, per
         * set.
         *
         * {string} @private
         */
        var SET_ORIGIN_COLUMN_LETTERS = 'AJSAJS';

        /**
         * The row letters (for northing) of the lower left value, per
         * set.
         *
         * {string} @private
         */
        var SET_ORIGIN_ROW_LETTERS = 'AFAFAF';

        var A = 65; // A
        var I = 73; // I
        var O = 79; // O
        var V = 86; // V
        var Z = 90; // Z
        var mgrs = {
          forward: forward$1,
          inverse: inverse$1,
          toPoint: toPoint$1
        };
        /**
         * Conversion of lat/lon to MGRS.
         *
         * @param {object} ll Object literal with lat and lon properties on a
         *     WGS84 ellipsoid.
         * @param {int} accuracy Accuracy in digits (5 for 1 m, 4 for 10 m, 3 for
         *      100 m, 2 for 1000 m or 1 for 10000 m). Optional, default is 5.
         * @return {string} the MGRS string for the given location and accuracy.
         */
        function forward$1(ll, accuracy) {
          accuracy = accuracy || 5; // default accuracy 1m
          return encode(LLtoUTM({
            lat: ll[1],
            lon: ll[0]
          }), accuracy);
        }

        /**
         * Conversion of MGRS to lat/lon.
         *
         * @param {string} mgrs MGRS string.
         * @return {array} An array with left (longitude), bottom (latitude), right
         *     (longitude) and top (latitude) values in WGS84, representing the
         *     bounding box for the provided MGRS reference.
         */
        function inverse$1(mgrs) {
          var bbox = UTMtoLL(decode(mgrs.toUpperCase()));
          if (bbox.lat && bbox.lon) {
            return [bbox.lon, bbox.lat, bbox.lon, bbox.lat];
          }
          return [bbox.left, bbox.bottom, bbox.right, bbox.top];
        }

        function toPoint$1(mgrs) {
          var bbox = UTMtoLL(decode(mgrs.toUpperCase()));
          if (bbox.lat && bbox.lon) {
            return [bbox.lon, bbox.lat];
          }
          return [(bbox.left + bbox.right) / 2, (bbox.top + bbox.bottom) / 2];
        }
        /**
         * Conversion from degrees to radians.
         *
         * @private
         * @param {number} deg the angle in degrees.
         * @return {number} the angle in radians.
         */
        function degToRad(deg) {
          return (deg * (Math.PI / 180.0));
        }

        /**
         * Conversion from radians to degrees.
         *
         * @private
         * @param {number} rad the angle in radians.
         * @return {number} the angle in degrees.
         */
        function radToDeg(rad) {
          return (180.0 * (rad / Math.PI));
        }

        /**
         * Converts a set of Longitude and Latitude co-ordinates to UTM
         * using the WGS84 ellipsoid.
         *
         * @private
         * @param {object} ll Object literal with lat and lon properties
         *     representing the WGS84 coordinate to be converted.
         * @return {object} Object literal containing the UTM value with easting,
         *     northing, zoneNumber and zoneLetter properties, and an optional
         *     accuracy property in digits. Returns null if the conversion failed.
         */
        function LLtoUTM(ll) {
          var Lat = ll.lat;
          var Long = ll.lon;
          var a = 6378137.0; //ellip.radius;
          var eccSquared = 0.00669438; //ellip.eccsq;
          var k0 = 0.9996;
          var LongOrigin;
          var eccPrimeSquared;
          var N, T, C, A, M;
          var LatRad = degToRad(Lat);
          var LongRad = degToRad(Long);
          var LongOriginRad;
          var ZoneNumber;
          // (int)
          ZoneNumber = Math.floor((Long + 180) / 6) + 1;

          //Make sure the longitude 180.00 is in Zone 60
          if (Long === 180) {
            ZoneNumber = 60;
          }

          // Special zone for Norway
          if (Lat >= 56.0 && Lat < 64.0 && Long >= 3.0 && Long < 12.0) {
            ZoneNumber = 32;
          }

          // Special zones for Svalbard
          if (Lat >= 72.0 && Lat < 84.0) {
            if (Long >= 0.0 && Long < 9.0) {
              ZoneNumber = 31;
            } else if (Long >= 9.0 && Long < 21.0) {
              ZoneNumber = 33;
            } else if (Long >= 21.0 && Long < 33.0) {
              ZoneNumber = 35;
            } else if (Long >= 33.0 && Long < 42.0) {
              ZoneNumber = 37;
            }
          }

          LongOrigin = (ZoneNumber - 1) * 6 - 180 + 3; //+3 puts origin
          // in middle of
          // zone
          LongOriginRad = degToRad(LongOrigin);

          eccPrimeSquared = (eccSquared) / (1 - eccSquared);

          N = a / Math.sqrt(1 - eccSquared * Math.sin(LatRad) * Math.sin(LatRad));
          T = Math.tan(LatRad) * Math.tan(LatRad);
          C = eccPrimeSquared * Math.cos(LatRad) * Math.cos(LatRad);
          A = Math.cos(LatRad) * (LongRad - LongOriginRad);

          M = a * ((1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256) * LatRad - (3 * eccSquared / 8 + 3 * eccSquared * eccSquared / 32 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(2 * LatRad) + (15 * eccSquared * eccSquared / 256 + 45 * eccSquared * eccSquared * eccSquared / 1024) * Math.sin(4 * LatRad) - (35 * eccSquared * eccSquared * eccSquared / 3072) * Math.sin(6 * LatRad));

          var UTMEasting = (k0 * N * (A + (1 - T + C) * A * A * A / 6.0 + (5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) * A * A * A * A * A / 120.0) + 500000.0);

          var UTMNorthing = (k0 * (M + N * Math.tan(LatRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24.0 + (61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSquared) * A * A * A * A * A * A / 720.0)));
          if (Lat < 0.0) {
            UTMNorthing += 10000000.0; //10000000 meter offset for
            // southern hemisphere
          }

          return {
            northing: Math.round(UTMNorthing),
            easting: Math.round(UTMEasting),
            zoneNumber: ZoneNumber,
            zoneLetter: getLetterDesignator(Lat)
          };
        }

        /**
         * Converts UTM coords to lat/long, using the WGS84 ellipsoid. This is a convenience
         * class where the Zone can be specified as a single string eg."60N" which
         * is then broken down into the ZoneNumber and ZoneLetter.
         *
         * @private
         * @param {object} utm An object literal with northing, easting, zoneNumber
         *     and zoneLetter properties. If an optional accuracy property is
         *     provided (in meters), a bounding box will be returned instead of
         *     latitude and longitude.
         * @return {object} An object literal containing either lat and lon values
         *     (if no accuracy was provided), or top, right, bottom and left values
         *     for the bounding box calculated according to the provided accuracy.
         *     Returns null if the conversion failed.
         */
        function UTMtoLL(utm) {

          var UTMNorthing = utm.northing;
          var UTMEasting = utm.easting;
          var zoneLetter = utm.zoneLetter;
          var zoneNumber = utm.zoneNumber;
          // check the ZoneNummber is valid
          if (zoneNumber < 0 || zoneNumber > 60) {
            return null;
          }

          var k0 = 0.9996;
          var a = 6378137.0; //ellip.radius;
          var eccSquared = 0.00669438; //ellip.eccsq;
          var eccPrimeSquared;
          var e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
          var N1, T1, C1, R1, D, M;
          var LongOrigin;
          var mu, phi1Rad;

          // remove 500,000 meter offset for longitude
          var x = UTMEasting - 500000.0;
          var y = UTMNorthing;

          // We must know somehow if we are in the Northern or Southern
          // hemisphere, this is the only time we use the letter So even
          // if the Zone letter isn't exactly correct it should indicate
          // the hemisphere correctly
          if (zoneLetter < 'N') {
            y -= 10000000.0; // remove 10,000,000 meter offset used
            // for southern hemisphere
          }

          // There are 60 zones with zone 1 being at West -180 to -174
          LongOrigin = (zoneNumber - 1) * 6 - 180 + 3; // +3 puts origin
          // in middle of
          // zone

          eccPrimeSquared = (eccSquared) / (1 - eccSquared);

          M = y / k0;
          mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared * eccSquared / 64 - 5 * eccSquared * eccSquared * eccSquared / 256));

          phi1Rad = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);
          // double phi1 = ProjMath.radToDeg(phi1Rad);

          N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
          T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
          C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
          R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
          D = x / (N1 * k0);

          var lat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * D * D * D * D / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * D * D * D * D * D * D / 720);
          lat = radToDeg(lat);

          var lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1Rad);
          lon = LongOrigin + radToDeg(lon);

          var result;
          if (utm.accuracy) {
            var topRight = UTMtoLL({
              northing: utm.northing + utm.accuracy,
              easting: utm.easting + utm.accuracy,
              zoneLetter: utm.zoneLetter,
              zoneNumber: utm.zoneNumber
            });
            result = {
              top: topRight.lat,
              right: topRight.lon,
              bottom: lat,
              left: lon
            };
          } else {
            result = {
              lat: lat,
              lon: lon
            };
          }
          return result;
        }

        /**
         * Calculates the MGRS letter designator for the given latitude.
         *
         * @private
         * @param {number} lat The latitude in WGS84 to get the letter designator
         *     for.
         * @return {char} The letter designator.
         */
        function getLetterDesignator(lat) {
          //This is here as an error flag to show that the Latitude is
          //outside MGRS limits
          var LetterDesignator = 'Z';

          if ((84 >= lat) && (lat >= 72)) {
            LetterDesignator = 'X';
          } else if ((72 > lat) && (lat >= 64)) {
            LetterDesignator = 'W';
          } else if ((64 > lat) && (lat >= 56)) {
            LetterDesignator = 'V';
          } else if ((56 > lat) && (lat >= 48)) {
            LetterDesignator = 'U';
          } else if ((48 > lat) && (lat >= 40)) {
            LetterDesignator = 'T';
          } else if ((40 > lat) && (lat >= 32)) {
            LetterDesignator = 'S';
          } else if ((32 > lat) && (lat >= 24)) {
            LetterDesignator = 'R';
          } else if ((24 > lat) && (lat >= 16)) {
            LetterDesignator = 'Q';
          } else if ((16 > lat) && (lat >= 8)) {
            LetterDesignator = 'P';
          } else if ((8 > lat) && (lat >= 0)) {
            LetterDesignator = 'N';
          } else if ((0 > lat) && (lat >= -8)) {
            LetterDesignator = 'M';
          } else if ((-8 > lat) && (lat >= -16)) {
            LetterDesignator = 'L';
          } else if ((-16 > lat) && (lat >= -24)) {
            LetterDesignator = 'K';
          } else if ((-24 > lat) && (lat >= -32)) {
            LetterDesignator = 'J';
          } else if ((-32 > lat) && (lat >= -40)) {
            LetterDesignator = 'H';
          } else if ((-40 > lat) && (lat >= -48)) {
            LetterDesignator = 'G';
          } else if ((-48 > lat) && (lat >= -56)) {
            LetterDesignator = 'F';
          } else if ((-56 > lat) && (lat >= -64)) {
            LetterDesignator = 'E';
          } else if ((-64 > lat) && (lat >= -72)) {
            LetterDesignator = 'D';
          } else if ((-72 > lat) && (lat >= -80)) {
            LetterDesignator = 'C';
          }
          return LetterDesignator;
        }

        /**
         * Encodes a UTM location as MGRS string.
         *
         * @private
         * @param {object} utm An object literal with easting, northing,
         *     zoneLetter, zoneNumber
         * @param {number} accuracy Accuracy in digits (1-5).
         * @return {string} MGRS string for the given UTM location.
         */
        function encode(utm, accuracy) {
          // prepend with leading zeroes
          var seasting = "00000" + utm.easting,
            snorthing = "00000" + utm.northing;

          return utm.zoneNumber + utm.zoneLetter + get100kID(utm.easting, utm.northing, utm.zoneNumber) + seasting.substr(seasting.length - 5, accuracy) + snorthing.substr(snorthing.length - 5, accuracy);
        }

        /**
         * Get the two letter 100k designator for a given UTM easting,
         * northing and zone number value.
         *
         * @private
         * @param {number} easting
         * @param {number} northing
         * @param {number} zoneNumber
         * @return the two letter 100k designator for the given UTM location.
         */
        function get100kID(easting, northing, zoneNumber) {
          var setParm = get100kSetForZone(zoneNumber);
          var setColumn = Math.floor(easting / 100000);
          var setRow = Math.floor(northing / 100000) % 20;
          return getLetter100kID(setColumn, setRow, setParm);
        }

        /**
         * Given a UTM zone number, figure out the MGRS 100K set it is in.
         *
         * @private
         * @param {number} i An UTM zone number.
         * @return {number} the 100k set the UTM zone is in.
         */
        function get100kSetForZone(i) {
          var setParm = i % NUM_100K_SETS;
          if (setParm === 0) {
            setParm = NUM_100K_SETS;
          }

          return setParm;
        }

        /**
         * Get the two-letter MGRS 100k designator given information
         * translated from the UTM northing, easting and zone number.
         *
         * @private
         * @param {number} column the column index as it relates to the MGRS
         *        100k set spreadsheet, created from the UTM easting.
         *        Values are 1-8.
         * @param {number} row the row index as it relates to the MGRS 100k set
         *        spreadsheet, created from the UTM northing value. Values
         *        are from 0-19.
         * @param {number} parm the set block, as it relates to the MGRS 100k set
         *        spreadsheet, created from the UTM zone. Values are from
         *        1-60.
         * @return two letter MGRS 100k code.
         */
        function getLetter100kID(column, row, parm) {
          // colOrigin and rowOrigin are the letters at the origin of the set
          var index = parm - 1;
          var colOrigin = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(index);
          var rowOrigin = SET_ORIGIN_ROW_LETTERS.charCodeAt(index);

          // colInt and rowInt are the letters to build to return
          var colInt = colOrigin + column - 1;
          var rowInt = rowOrigin + row;
          var rollover = false;

          if (colInt > Z) {
            colInt = colInt - Z + A - 1;
            rollover = true;
          }

          if (colInt === I || (colOrigin < I && colInt > I) || ((colInt > I || colOrigin < I) && rollover)) {
            colInt++;
          }

          if (colInt === O || (colOrigin < O && colInt > O) || ((colInt > O || colOrigin < O) && rollover)) {
            colInt++;

            if (colInt === I) {
              colInt++;
            }
          }

          if (colInt > Z) {
            colInt = colInt - Z + A - 1;
          }

          if (rowInt > V) {
            rowInt = rowInt - V + A - 1;
            rollover = true;
          } else {
            rollover = false;
          }

          if (((rowInt === I) || ((rowOrigin < I) && (rowInt > I))) || (((rowInt > I) || (rowOrigin < I)) && rollover)) {
            rowInt++;
          }

          if (((rowInt === O) || ((rowOrigin < O) && (rowInt > O))) || (((rowInt > O) || (rowOrigin < O)) && rollover)) {
            rowInt++;

            if (rowInt === I) {
              rowInt++;
            }
          }

          if (rowInt > V) {
            rowInt = rowInt - V + A - 1;
          }

          var twoLetter = String.fromCharCode(colInt) + String.fromCharCode(rowInt);
          return twoLetter;
        }

        /**
         * Decode the UTM parameters from a MGRS string.
         *
         * @private
         * @param {string} mgrsString an UPPERCASE coordinate string is expected.
         * @return {object} An object literal with easting, northing, zoneLetter,
         *     zoneNumber and accuracy (in meters) properties.
         */
        function decode(mgrsString) {

          if (mgrsString && mgrsString.length === 0) {
            throw ("MGRSPoint coverting from nothing");
          }

          var length = mgrsString.length;

          var hunK = null;
          var sb = "";
          var testChar;
          var i = 0;

          // get Zone number
          while (!(/[A-Z]/).test(testChar = mgrsString.charAt(i))) {
            if (i >= 2) {
              throw ("MGRSPoint bad conversion from: " + mgrsString);
            }
            sb += testChar;
            i++;
          }

          var zoneNumber = parseInt(sb, 10);

          if (i === 0 || i + 3 > length) {
            // A good MGRS string has to be 4-5 digits long,
            // ##AAA/#AAA at least.
            throw ("MGRSPoint bad conversion from: " + mgrsString);
          }

          var zoneLetter = mgrsString.charAt(i++);

          // Should we check the zone letter here? Why not.
          if (zoneLetter <= 'A' || zoneLetter === 'B' || zoneLetter === 'Y' || zoneLetter >= 'Z' || zoneLetter === 'I' || zoneLetter === 'O') {
            throw ("MGRSPoint zone letter " + zoneLetter + " not handled: " + mgrsString);
          }

          hunK = mgrsString.substring(i, i += 2);

          var set = get100kSetForZone(zoneNumber);

          var east100k = getEastingFromChar(hunK.charAt(0), set);
          var north100k = getNorthingFromChar(hunK.charAt(1), set);

          // We have a bug where the northing may be 2000000 too low.
          // How
          // do we know when to roll over?

          while (north100k < getMinNorthing(zoneLetter)) {
            north100k += 2000000;
          }

          // calculate the char index for easting/northing separator
          var remainder = length - i;

          if (remainder % 2 !== 0) {
            throw ("MGRSPoint has to have an even number \nof digits after the zone letter and two 100km letters - front \nhalf for easting meters, second half for \nnorthing meters" + mgrsString);
          }

          var sep = remainder / 2;

          var sepEasting = 0.0;
          var sepNorthing = 0.0;
          var accuracyBonus, sepEastingString, sepNorthingString, easting, northing;
          if (sep > 0) {
            accuracyBonus = 100000.0 / Math.pow(10, sep);
            sepEastingString = mgrsString.substring(i, i + sep);
            sepEasting = parseFloat(sepEastingString) * accuracyBonus;
            sepNorthingString = mgrsString.substring(i + sep);
            sepNorthing = parseFloat(sepNorthingString) * accuracyBonus;
          }

          easting = sepEasting + east100k;
          northing = sepNorthing + north100k;

          return {
            easting: easting,
            northing: northing,
            zoneLetter: zoneLetter,
            zoneNumber: zoneNumber,
            accuracy: accuracyBonus
          };
        }

        /**
         * Given the first letter from a two-letter MGRS 100k zone, and given the
         * MGRS table set for the zone number, figure out the easting value that
         * should be added to the other, secondary easting value.
         *
         * @private
         * @param {char} e The first letter from a two-letter MGRS 100´k zone.
         * @param {number} set The MGRS table set for the zone number.
         * @return {number} The easting value for the given letter and set.
         */
        function getEastingFromChar(e, set) {
          // colOrigin is the letter at the origin of the set for the
          // column
          var curCol = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(set - 1);
          var eastingValue = 100000.0;
          var rewindMarker = false;

          while (curCol !== e.charCodeAt(0)) {
            curCol++;
            if (curCol === I) {
              curCol++;
            }
            if (curCol === O) {
              curCol++;
            }
            if (curCol > Z) {
              if (rewindMarker) {
                throw ("Bad character: " + e);
              }
              curCol = A;
              rewindMarker = true;
            }
            eastingValue += 100000.0;
          }

          return eastingValue;
        }

        /**
         * Given the second letter from a two-letter MGRS 100k zone, and given the
         * MGRS table set for the zone number, figure out the northing value that
         * should be added to the other, secondary northing value. You have to
         * remember that Northings are determined from the equator, and the vertical
         * cycle of letters mean a 2000000 additional northing meters. This happens
         * approx. every 18 degrees of latitude. This method does *NOT* count any
         * additional northings. You have to figure out how many 2000000 meters need
         * to be added for the zone letter of the MGRS coordinate.
         *
         * @private
         * @param {char} n Second letter of the MGRS 100k zone
         * @param {number} set The MGRS table set number, which is dependent on the
         *     UTM zone number.
         * @return {number} The northing value for the given letter and set.
         */
        function getNorthingFromChar(n, set) {

          if (n > 'V') {
            throw ("MGRSPoint given invalid Northing " + n);
          }

          // rowOrigin is the letter at the origin of the set for the
          // column
          var curRow = SET_ORIGIN_ROW_LETTERS.charCodeAt(set - 1);
          var northingValue = 0.0;
          var rewindMarker = false;

          while (curRow !== n.charCodeAt(0)) {
            curRow++;
            if (curRow === I) {
              curRow++;
            }
            if (curRow === O) {
              curRow++;
            }
            // fixing a bug making whole application hang in this loop
            // when 'n' is a wrong character
            if (curRow > V) {
              if (rewindMarker) { // making sure that this loop ends
                throw ("Bad character: " + n);
              }
              curRow = A;
              rewindMarker = true;
            }
            northingValue += 100000.0;
          }

          return northingValue;
        }

        /**
         * The function getMinNorthing returns the minimum northing value of a MGRS
         * zone.
         *
         * Ported from Geotrans' c Lattitude_Band_Value structure table.
         *
         * @private
         * @param {char} zoneLetter The MGRS zone to get the min northing for.
         * @return {number}
         */
        function getMinNorthing(zoneLetter) {
          var northing;
          switch (zoneLetter) {
            case 'C':
              northing = 1100000.0;
              break;
            case 'D':
              northing = 2000000.0;
              break;
            case 'E':
              northing = 2800000.0;
              break;
            case 'F':
              northing = 3700000.0;
              break;
            case 'G':
              northing = 4600000.0;
              break;
            case 'H':
              northing = 5500000.0;
              break;
            case 'J':
              northing = 6400000.0;
              break;
            case 'K':
              northing = 7300000.0;
              break;
            case 'L':
              northing = 8200000.0;
              break;
            case 'M':
              northing = 9100000.0;
              break;
            case 'N':
              northing = 0.0;
              break;
            case 'P':
              northing = 800000.0;
              break;
            case 'Q':
              northing = 1700000.0;
              break;
            case 'R':
              northing = 2600000.0;
              break;
            case 'S':
              northing = 3500000.0;
              break;
            case 'T':
              northing = 4400000.0;
              break;
            case 'U':
              northing = 5300000.0;
              break;
            case 'V':
              northing = 6200000.0;
              break;
            case 'W':
              northing = 7000000.0;
              break;
            case 'X':
              northing = 7900000.0;
              break;
            default:
              northing = -1.0;
          }
          if (northing >= 0.0) {
            return northing;
          } else {
            throw ("Invalid zone letter: " + zoneLetter);
          }

        }

        function Point(x, y, z) {
          if (!(this instanceof Point)) {
            return new Point(x, y, z);
          }
          if (Array.isArray(x)) {
            this.x = x[0];
            this.y = x[1];
            this.z = x[2] || 0.0;
          } else if (typeof x === 'object') {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z || 0.0;
          } else if (typeof x === 'string' && typeof y === 'undefined') {
            var coords = x.split(',');
            this.x = parseFloat(coords[0], 10);
            this.y = parseFloat(coords[1], 10);
            this.z = parseFloat(coords[2], 10) || 0.0;
          } else {
            this.x = x;
            this.y = y;
            this.z = z || 0.0;
          }
          console.warn('proj4.Point will be removed in version 3, use proj4.toPoint');
        }

        Point.fromMGRS = function (mgrsStr) {
          return new Point(toPoint$1(mgrsStr));
        };
        Point.prototype.toMGRS = function (accuracy) {
          return forward$1([this.x, this.y], accuracy);
        };

        var C00 = 1;
        var C02 = 0.25;
        var C04 = 0.046875;
        var C06 = 0.01953125;
        var C08 = 0.01068115234375;
        var C22 = 0.75;
        var C44 = 0.46875;
        var C46 = 0.01302083333333333333;
        var C48 = 0.00712076822916666666;
        var C66 = 0.36458333333333333333;
        var C68 = 0.00569661458333333333;
        var C88 = 0.3076171875;

        var pj_enfn = function (es) {
          var en = [];
          en[0] = C00 - es * (C02 + es * (C04 + es * (C06 + es * C08)));
          en[1] = es * (C22 - es * (C04 + es * (C06 + es * C08)));
          var t = es * es;
          en[2] = t * (C44 - es * (C46 + es * C48));
          t *= es;
          en[3] = t * (C66 - es * C68);
          en[4] = t * es * C88;
          return en;
        };

        var pj_mlfn = function (phi, sphi, cphi, en) {
          cphi *= sphi;
          sphi *= sphi;
          return (en[0] * phi - cphi * (en[1] + sphi * (en[2] + sphi * (en[3] + sphi * en[4]))));
        };

        var MAX_ITER = 20;

        var pj_inv_mlfn = function (arg, es, en) {
          var k = 1 / (1 - es);
          var phi = arg;
          for (var i = MAX_ITER; i; --i) {
            /* rarely goes over 2 iterations */
            var s = Math.sin(phi);
            var t = 1 - es * s * s;
            //t = this.pj_mlfn(phi, s, Math.cos(phi), en) - arg;
            //phi -= t * (t * Math.sqrt(t)) * k;
            t = (pj_mlfn(phi, s, Math.cos(phi), en) - arg) * (t * Math.sqrt(t)) * k;
            phi -= t;
            if (Math.abs(t) < EPSLN) {
              return phi;
            }
          }
          //..reportError("cass:pj_inv_mlfn: Convergence error");
          return phi;
        };

        // Heavily based on this tmerc projection implementation
        // https://github.com/mbloch/mapshaper-proj/blob/master/src/projections/tmerc.js

        function init$2() {
          this.x0 = this.x0 !== undefined ? this.x0 : 0;
          this.y0 = this.y0 !== undefined ? this.y0 : 0;
          this.long0 = this.long0 !== undefined ? this.long0 : 0;
          this.lat0 = this.lat0 !== undefined ? this.lat0 : 0;

          if (this.es) {
            this.en = pj_enfn(this.es);
            this.ml0 = pj_mlfn(this.lat0, Math.sin(this.lat0), Math.cos(this.lat0), this.en);
          }
        }

        /**
            Transverse Mercator Forward  - long/lat to x/y
            long/lat in radians
          */
        function forward$2(p) {
          var lon = p.x;
          var lat = p.y;

          var delta_lon = adjust_lon(lon - this.long0);
          var con;
          var x, y;
          var sin_phi = Math.sin(lat);
          var cos_phi = Math.cos(lat);

          if (!this.es) {
            var b = cos_phi * Math.sin(delta_lon);

            if ((Math.abs(Math.abs(b) - 1)) < EPSLN) {
              return (93);
            } else {
              x = 0.5 * this.a * this.k0 * Math.log((1 + b) / (1 - b)) + this.x0;
              y = cos_phi * Math.cos(delta_lon) / Math.sqrt(1 - Math.pow(b, 2));
              b = Math.abs(y);

              if (b >= 1) {
                if ((b - 1) > EPSLN) {
                  return (93);
                } else {
                  y = 0;
                }
              } else {
                y = Math.acos(y);
              }

              if (lat < 0) {
                y = -y;
              }

              y = this.a * this.k0 * (y - this.lat0) + this.y0;
            }
          } else {
            var al = cos_phi * delta_lon;
            var als = Math.pow(al, 2);
            var c = this.ep2 * Math.pow(cos_phi, 2);
            var cs = Math.pow(c, 2);
            var tq = Math.abs(cos_phi) > EPSLN ? Math.tan(lat) : 0;
            var t = Math.pow(tq, 2);
            var ts = Math.pow(t, 2);
            con = 1 - this.es * Math.pow(sin_phi, 2);
            al = al / Math.sqrt(con);
            var ml = pj_mlfn(lat, sin_phi, cos_phi, this.en);

            x = this.a * (this.k0 * al * (1 +
                als / 6 * (1 - t + c +
                  als / 20 * (5 - 18 * t + ts + 14 * c - 58 * t * c +
                    als / 42 * (61 + 179 * ts - ts * t - 479 * t))))) +
              this.x0;

            y = this.a * (this.k0 * (ml - this.ml0 +
                sin_phi * delta_lon * al / 2 * (1 +
                  als / 12 * (5 - t + 9 * c + 4 * cs +
                    als / 30 * (61 + ts - 58 * t + 270 * c - 330 * t * c +
                      als / 56 * (1385 + 543 * ts - ts * t - 3111 * t)))))) +
              this.y0;
          }

          p.x = x;
          p.y = y;

          return p;
        }

        /**
            Transverse Mercator Inverse  -  x/y to long/lat
          */
        function inverse$2(p) {
          var con, phi;
          var lat, lon;
          var x = (p.x - this.x0) * (1 / this.a);
          var y = (p.y - this.y0) * (1 / this.a);

          if (!this.es) {
            var f = Math.exp(x / this.k0);
            var g = 0.5 * (f - 1 / f);
            var temp = this.lat0 + y / this.k0;
            var h = Math.cos(temp);
            con = Math.sqrt((1 - Math.pow(h, 2)) / (1 + Math.pow(g, 2)));
            lat = Math.asin(con);

            if (y < 0) {
              lat = -lat;
            }

            if ((g === 0) && (h === 0)) {
              lon = 0;
            } else {
              lon = adjust_lon(Math.atan2(g, h) + this.long0);
            }
          } else { // ellipsoidal form
            con = this.ml0 + y / this.k0;
            phi = pj_inv_mlfn(con, this.es, this.en);

            if (Math.abs(phi) < HALF_PI) {
              var sin_phi = Math.sin(phi);
              var cos_phi = Math.cos(phi);
              var tan_phi = Math.abs(cos_phi) > EPSLN ? Math.tan(phi) : 0;
              var c = this.ep2 * Math.pow(cos_phi, 2);
              var cs = Math.pow(c, 2);
              var t = Math.pow(tan_phi, 2);
              var ts = Math.pow(t, 2);
              con = 1 - this.es * Math.pow(sin_phi, 2);
              var d = x * Math.sqrt(con) / this.k0;
              var ds = Math.pow(d, 2);
              con = con * tan_phi;

              lat = phi - (con * ds / (1 - this.es)) * 0.5 * (1 -
                ds / 12 * (5 + 3 * t - 9 * c * t + c - 4 * cs -
                  ds / 30 * (61 + 90 * t - 252 * c * t + 45 * ts + 46 * c -
                    ds / 56 * (1385 + 3633 * t + 4095 * ts + 1574 * ts * t))));

              lon = adjust_lon(this.long0 + (d * (1 -
                ds / 6 * (1 + 2 * t + c -
                  ds / 20 * (5 + 28 * t + 24 * ts + 8 * c * t + 6 * c -
                    ds / 42 * (61 + 662 * t + 1320 * ts + 720 * ts * t)))) / cos_phi));
            } else {
              lat = HALF_PI * sign(y);
              lon = 0;
            }
          }

          p.x = lon;
          p.y = lat;

          return p;
        }

        var names$3 = ["Transverse_Mercator", "Transverse Mercator", "tmerc"];
        var tmerc = {
          init: init$2,
          forward: forward$2,
          inverse: inverse$2,
          names: names$3
        };

        var sinh = function (x) {
          var r = Math.exp(x);
          r = (r - 1 / r) / 2;
          return r;
        };

        var hypot = function (x, y) {
          x = Math.abs(x);
          y = Math.abs(y);
          var a = Math.max(x, y);
          var b = Math.min(x, y) / (a ? a : 1);

          return a * Math.sqrt(1 + Math.pow(b, 2));
        };

        var log1py = function (x) {
          var y = 1 + x;
          var z = y - 1;

          return z === 0 ? x : x * Math.log(y) / z;
        };

        var asinhy = function (x) {
          var y = Math.abs(x);
          y = log1py(y * (1 + y / (hypot(1, y) + 1)));

          return x < 0 ? -y : y;
        };

        var gatg = function (pp, B) {
          var cos_2B = 2 * Math.cos(2 * B);
          var i = pp.length - 1;
          var h1 = pp[i];
          var h2 = 0;
          var h;

          while (--i >= 0) {
            h = -h2 + cos_2B * h1 + pp[i];
            h2 = h1;
            h1 = h;
          }

          return (B + h * Math.sin(2 * B));
        };

        var clens = function (pp, arg_r) {
          var r = 2 * Math.cos(arg_r);
          var i = pp.length - 1;
          var hr1 = pp[i];
          var hr2 = 0;
          var hr;

          while (--i >= 0) {
            hr = -hr2 + r * hr1 + pp[i];
            hr2 = hr1;
            hr1 = hr;
          }

          return Math.sin(arg_r) * hr;
        };

        var cosh = function (x) {
          var r = Math.exp(x);
          r = (r + 1 / r) / 2;
          return r;
        };

        var clens_cmplx = function (pp, arg_r, arg_i) {
          var sin_arg_r = Math.sin(arg_r);
          var cos_arg_r = Math.cos(arg_r);
          var sinh_arg_i = sinh(arg_i);
          var cosh_arg_i = cosh(arg_i);
          var r = 2 * cos_arg_r * cosh_arg_i;
          var i = -2 * sin_arg_r * sinh_arg_i;
          var j = pp.length - 1;
          var hr = pp[j];
          var hi1 = 0;
          var hr1 = 0;
          var hi = 0;
          var hr2;
          var hi2;

          while (--j >= 0) {
            hr2 = hr1;
            hi2 = hi1;
            hr1 = hr;
            hi1 = hi;
            hr = -hr2 + r * hr1 - i * hi1 + pp[j];
            hi = -hi2 + i * hr1 + r * hi1;
          }

          r = sin_arg_r * cosh_arg_i;
          i = cos_arg_r * sinh_arg_i;

          return [r * hr - i * hi, r * hi + i * hr];
        };

        // Heavily based on this etmerc projection implementation
        // https://github.com/mbloch/mapshaper-proj/blob/master/src/projections/etmerc.js

        function init$3() {
          if (this.es === undefined || this.es <= 0) {
            throw new Error('incorrect elliptical usage');
          }

          this.x0 = this.x0 !== undefined ? this.x0 : 0;
          this.y0 = this.y0 !== undefined ? this.y0 : 0;
          this.long0 = this.long0 !== undefined ? this.long0 : 0;
          this.lat0 = this.lat0 !== undefined ? this.lat0 : 0;

          this.cgb = [];
          this.cbg = [];
          this.utg = [];
          this.gtu = [];

          var f = this.es / (1 + Math.sqrt(1 - this.es));
          var n = f / (2 - f);
          var np = n;

          this.cgb[0] = n * (2 + n * (-2 / 3 + n * (-2 + n * (116 / 45 + n * (26 / 45 + n * (-2854 / 675))))));
          this.cbg[0] = n * (-2 + n * (2 / 3 + n * (4 / 3 + n * (-82 / 45 + n * (32 / 45 + n * (4642 / 4725))))));

          np = np * n;
          this.cgb[1] = np * (7 / 3 + n * (-8 / 5 + n * (-227 / 45 + n * (2704 / 315 + n * (2323 / 945)))));
          this.cbg[1] = np * (5 / 3 + n * (-16 / 15 + n * (-13 / 9 + n * (904 / 315 + n * (-1522 / 945)))));

          np = np * n;
          this.cgb[2] = np * (56 / 15 + n * (-136 / 35 + n * (-1262 / 105 + n * (73814 / 2835))));
          this.cbg[2] = np * (-26 / 15 + n * (34 / 21 + n * (8 / 5 + n * (-12686 / 2835))));

          np = np * n;
          this.cgb[3] = np * (4279 / 630 + n * (-332 / 35 + n * (-399572 / 14175)));
          this.cbg[3] = np * (1237 / 630 + n * (-12 / 5 + n * (-24832 / 14175)));

          np = np * n;
          this.cgb[4] = np * (4174 / 315 + n * (-144838 / 6237));
          this.cbg[4] = np * (-734 / 315 + n * (109598 / 31185));

          np = np * n;
          this.cgb[5] = np * (601676 / 22275);
          this.cbg[5] = np * (444337 / 155925);

          np = Math.pow(n, 2);
          this.Qn = this.k0 / (1 + n) * (1 + np * (1 / 4 + np * (1 / 64 + np / 256)));

          this.utg[0] = n * (-0.5 + n * (2 / 3 + n * (-37 / 96 + n * (1 / 360 + n * (81 / 512 + n * (-96199 / 604800))))));
          this.gtu[0] = n * (0.5 + n * (-2 / 3 + n * (5 / 16 + n * (41 / 180 + n * (-127 / 288 + n * (7891 / 37800))))));

          this.utg[1] = np * (-1 / 48 + n * (-1 / 15 + n * (437 / 1440 + n * (-46 / 105 + n * (1118711 / 3870720)))));
          this.gtu[1] = np * (13 / 48 + n * (-3 / 5 + n * (557 / 1440 + n * (281 / 630 + n * (-1983433 / 1935360)))));

          np = np * n;
          this.utg[2] = np * (-17 / 480 + n * (37 / 840 + n * (209 / 4480 + n * (-5569 / 90720))));
          this.gtu[2] = np * (61 / 240 + n * (-103 / 140 + n * (15061 / 26880 + n * (167603 / 181440))));

          np = np * n;
          this.utg[3] = np * (-4397 / 161280 + n * (11 / 504 + n * (830251 / 7257600)));
          this.gtu[3] = np * (49561 / 161280 + n * (-179 / 168 + n * (6601661 / 7257600)));

          np = np * n;
          this.utg[4] = np * (-4583 / 161280 + n * (108847 / 3991680));
          this.gtu[4] = np * (34729 / 80640 + n * (-3418889 / 1995840));

          np = np * n;
          this.utg[5] = np * (-20648693 / 638668800);
          this.gtu[5] = np * (212378941 / 319334400);

          var Z = gatg(this.cbg, this.lat0);
          this.Zb = -this.Qn * (Z + clens(this.gtu, 2 * Z));
        }

        function forward$3(p) {
          var Ce = adjust_lon(p.x - this.long0);
          var Cn = p.y;

          Cn = gatg(this.cbg, Cn);
          var sin_Cn = Math.sin(Cn);
          var cos_Cn = Math.cos(Cn);
          var sin_Ce = Math.sin(Ce);
          var cos_Ce = Math.cos(Ce);

          Cn = Math.atan2(sin_Cn, cos_Ce * cos_Cn);
          Ce = Math.atan2(sin_Ce * cos_Cn, hypot(sin_Cn, cos_Cn * cos_Ce));
          Ce = asinhy(Math.tan(Ce));

          var tmp = clens_cmplx(this.gtu, 2 * Cn, 2 * Ce);

          Cn = Cn + tmp[0];
          Ce = Ce + tmp[1];

          var x;
          var y;

          if (Math.abs(Ce) <= 2.623395162778) {
            x = this.a * (this.Qn * Ce) + this.x0;
            y = this.a * (this.Qn * Cn + this.Zb) + this.y0;
          } else {
            x = Infinity;
            y = Infinity;
          }

          p.x = x;
          p.y = y;

          return p;
        }

        function inverse$3(p) {
          var Ce = (p.x - this.x0) * (1 / this.a);
          var Cn = (p.y - this.y0) * (1 / this.a);

          Cn = (Cn - this.Zb) / this.Qn;
          Ce = Ce / this.Qn;

          var lon;
          var lat;

          if (Math.abs(Ce) <= 2.623395162778) {
            var tmp = clens_cmplx(this.utg, 2 * Cn, 2 * Ce);

            Cn = Cn + tmp[0];
            Ce = Ce + tmp[1];
            Ce = Math.atan(sinh(Ce));

            var sin_Cn = Math.sin(Cn);
            var cos_Cn = Math.cos(Cn);
            var sin_Ce = Math.sin(Ce);
            var cos_Ce = Math.cos(Ce);

            Cn = Math.atan2(sin_Cn * cos_Ce, hypot(sin_Ce, cos_Ce * cos_Cn));
            Ce = Math.atan2(sin_Ce, cos_Ce * cos_Cn);

            lon = adjust_lon(Ce + this.long0);
            lat = gatg(this.cgb, Cn);
          } else {
            lon = Infinity;
            lat = Infinity;
          }

          p.x = lon;
          p.y = lat;

          return p;
        }

        var names$4 = ["Extended_Transverse_Mercator", "Extended Transverse Mercator", "etmerc"];
        var etmerc = {
          init: init$3,
          forward: forward$3,
          inverse: inverse$3,
          names: names$4
        };

        var adjust_zone = function (zone, lon) {
          if (zone === undefined) {
            zone = Math.floor((adjust_lon(lon) + Math.PI) * 30 / Math.PI) + 1;

            if (zone < 0) {
              return 0;
            } else if (zone > 60) {
              return 60;
            }
          }
          return zone;
        };

        var dependsOn = 'etmerc';

        function init$4() {
          var zone = adjust_zone(this.zone, this.long0);
          if (zone === undefined) {
            throw new Error('unknown utm zone');
          }
          this.lat0 = 0;
          this.long0 = ((6 * Math.abs(zone)) - 183) * D2R;
          this.x0 = 500000;
          this.y0 = this.utmSouth ? 10000000 : 0;
          this.k0 = 0.9996;

          etmerc.init.apply(this);
          this.forward = etmerc.forward;
          this.inverse = etmerc.inverse;
        }

        var names$5 = ["Universal Transverse Mercator System", "utm"];
        var utm = {
          init: init$4,
          names: names$5,
          dependsOn: dependsOn
        };

        var srat = function (esinp, exp) {
          return (Math.pow((1 - esinp) / (1 + esinp), exp));
        };

        var MAX_ITER$1 = 20;

        function init$6() {
          var sphi = Math.sin(this.lat0);
          var cphi = Math.cos(this.lat0);
          cphi *= cphi;
          this.rc = Math.sqrt(1 - this.es) / (1 - this.es * sphi * sphi);
          this.C = Math.sqrt(1 + this.es * cphi * cphi / (1 - this.es));
          this.phic0 = Math.asin(sphi / this.C);
          this.ratexp = 0.5 * this.C * this.e;
          this.K = Math.tan(0.5 * this.phic0 + FORTPI) / (Math.pow(Math.tan(0.5 * this.lat0 + FORTPI), this.C) * srat(this.e * sphi, this.ratexp));
        }

        function forward$5(p) {
          var lon = p.x;
          var lat = p.y;

          p.y = 2 * Math.atan(this.K * Math.pow(Math.tan(0.5 * lat + FORTPI), this.C) * srat(this.e * Math.sin(lat), this.ratexp)) - HALF_PI;
          p.x = this.C * lon;
          return p;
        }

        function inverse$5(p) {
          var DEL_TOL = 1e-14;
          var lon = p.x / this.C;
          var lat = p.y;
          var num = Math.pow(Math.tan(0.5 * lat + FORTPI) / this.K, 1 / this.C);
          for (var i = MAX_ITER$1; i > 0; --i) {
            lat = 2 * Math.atan(num * srat(this.e * Math.sin(p.y), -0.5 * this.e)) - HALF_PI;
            if (Math.abs(lat - p.y) < DEL_TOL) {
              break;
            }
            p.y = lat;
          }
          /* convergence failed */
          if (!i) {
            return null;
          }
          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$7 = ["gauss"];
        var gauss = {
          init: init$6,
          forward: forward$5,
          inverse: inverse$5,
          names: names$7
        };

        function init$5() {
          gauss.init.apply(this);
          if (!this.rc) {
            return;
          }
          this.sinc0 = Math.sin(this.phic0);
          this.cosc0 = Math.cos(this.phic0);
          this.R2 = 2 * this.rc;
          if (!this.title) {
            this.title = "Oblique Stereographic Alternative";
          }
        }

        function forward$4(p) {
          var sinc, cosc, cosl, k;
          p.x = adjust_lon(p.x - this.long0);
          gauss.forward.apply(this, [p]);
          sinc = Math.sin(p.y);
          cosc = Math.cos(p.y);
          cosl = Math.cos(p.x);
          k = this.k0 * this.R2 / (1 + this.sinc0 * sinc + this.cosc0 * cosc * cosl);
          p.x = k * cosc * Math.sin(p.x);
          p.y = k * (this.cosc0 * sinc - this.sinc0 * cosc * cosl);
          p.x = this.a * p.x + this.x0;
          p.y = this.a * p.y + this.y0;
          return p;
        }

        function inverse$4(p) {
          var sinc, cosc, lon, lat, rho;
          p.x = (p.x - this.x0) / this.a;
          p.y = (p.y - this.y0) / this.a;

          p.x /= this.k0;
          p.y /= this.k0;
          if ((rho = Math.sqrt(p.x * p.x + p.y * p.y))) {
            var c = 2 * Math.atan2(rho, this.R2);
            sinc = Math.sin(c);
            cosc = Math.cos(c);
            lat = Math.asin(cosc * this.sinc0 + p.y * sinc * this.cosc0 / rho);
            lon = Math.atan2(p.x * sinc, rho * this.cosc0 * cosc - p.y * this.sinc0 * sinc);
          } else {
            lat = this.phic0;
            lon = 0;
          }

          p.x = lon;
          p.y = lat;
          gauss.inverse.apply(this, [p]);
          p.x = adjust_lon(p.x + this.long0);
          return p;
        }

        var names$6 = ["Stereographic_North_Pole", "Oblique_Stereographic", "Polar_Stereographic", "sterea", "Oblique Stereographic Alternative", "Double_Stereographic"];
        var sterea = {
          init: init$5,
          forward: forward$4,
          inverse: inverse$4,
          names: names$6
        };

        function ssfn_(phit, sinphi, eccen) {
          sinphi *= eccen;
          return (Math.tan(0.5 * (HALF_PI + phit)) * Math.pow((1 - sinphi) / (1 + sinphi), 0.5 * eccen));
        }

        function init$7() {
          this.coslat0 = Math.cos(this.lat0);
          this.sinlat0 = Math.sin(this.lat0);
          if (this.sphere) {
            if (this.k0 === 1 && !isNaN(this.lat_ts) && Math.abs(this.coslat0) <= EPSLN) {
              this.k0 = 0.5 * (1 + sign(this.lat0) * Math.sin(this.lat_ts));
            }
          } else {
            if (Math.abs(this.coslat0) <= EPSLN) {
              if (this.lat0 > 0) {
                //North pole
                //trace('stere:north pole');
                this.con = 1;
              } else {
                //South pole
                //trace('stere:south pole');
                this.con = -1;
              }
            }
            this.cons = Math.sqrt(Math.pow(1 + this.e, 1 + this.e) * Math.pow(1 - this.e, 1 - this.e));
            if (this.k0 === 1 && !isNaN(this.lat_ts) && Math.abs(this.coslat0) <= EPSLN) {
              this.k0 = 0.5 * this.cons * msfnz(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)) / tsfnz(this.e, this.con * this.lat_ts, this.con * Math.sin(this.lat_ts));
            }
            this.ms1 = msfnz(this.e, this.sinlat0, this.coslat0);
            this.X0 = 2 * Math.atan(this.ssfn_(this.lat0, this.sinlat0, this.e)) - HALF_PI;
            this.cosX0 = Math.cos(this.X0);
            this.sinX0 = Math.sin(this.X0);
          }
        }

        // Stereographic forward equations--mapping lat,long to x,y
        function forward$6(p) {
          var lon = p.x;
          var lat = p.y;
          var sinlat = Math.sin(lat);
          var coslat = Math.cos(lat);
          var A, X, sinX, cosX, ts, rh;
          var dlon = adjust_lon(lon - this.long0);

          if (Math.abs(Math.abs(lon - this.long0) - Math.PI) <= EPSLN && Math.abs(lat + this.lat0) <= EPSLN) {
            //case of the origine point
            //trace('stere:this is the origin point');
            p.x = NaN;
            p.y = NaN;
            return p;
          }
          if (this.sphere) {
            //trace('stere:sphere case');
            A = 2 * this.k0 / (1 + this.sinlat0 * sinlat + this.coslat0 * coslat * Math.cos(dlon));
            p.x = this.a * A * coslat * Math.sin(dlon) + this.x0;
            p.y = this.a * A * (this.coslat0 * sinlat - this.sinlat0 * coslat * Math.cos(dlon)) + this.y0;
            return p;
          } else {
            X = 2 * Math.atan(this.ssfn_(lat, sinlat, this.e)) - HALF_PI;
            cosX = Math.cos(X);
            sinX = Math.sin(X);
            if (Math.abs(this.coslat0) <= EPSLN) {
              ts = tsfnz(this.e, lat * this.con, this.con * sinlat);
              rh = 2 * this.a * this.k0 * ts / this.cons;
              p.x = this.x0 + rh * Math.sin(lon - this.long0);
              p.y = this.y0 - this.con * rh * Math.cos(lon - this.long0);
              //trace(p.toString());
              return p;
            } else if (Math.abs(this.sinlat0) < EPSLN) {
              //Eq
              //trace('stere:equateur');
              A = 2 * this.a * this.k0 / (1 + cosX * Math.cos(dlon));
              p.y = A * sinX;
            } else {
              //other case
              //trace('stere:normal case');
              A = 2 * this.a * this.k0 * this.ms1 / (this.cosX0 * (1 + this.sinX0 * sinX + this.cosX0 * cosX * Math.cos(dlon)));
              p.y = A * (this.cosX0 * sinX - this.sinX0 * cosX * Math.cos(dlon)) + this.y0;
            }
            p.x = A * cosX * Math.sin(dlon) + this.x0;
          }
          //trace(p.toString());
          return p;
        }

        //* Stereographic inverse equations--mapping x,y to lat/long
        function inverse$6(p) {
          p.x -= this.x0;
          p.y -= this.y0;
          var lon, lat, ts, ce, Chi;
          var rh = Math.sqrt(p.x * p.x + p.y * p.y);
          if (this.sphere) {
            var c = 2 * Math.atan(rh / (2 * this.a * this.k0));
            lon = this.long0;
            lat = this.lat0;
            if (rh <= EPSLN) {
              p.x = lon;
              p.y = lat;
              return p;
            }
            lat = Math.asin(Math.cos(c) * this.sinlat0 + p.y * Math.sin(c) * this.coslat0 / rh);
            if (Math.abs(this.coslat0) < EPSLN) {
              if (this.lat0 > 0) {
                lon = adjust_lon(this.long0 + Math.atan2(p.x, -1 * p.y));
              } else {
                lon = adjust_lon(this.long0 + Math.atan2(p.x, p.y));
              }
            } else {
              lon = adjust_lon(this.long0 + Math.atan2(p.x * Math.sin(c), rh * this.coslat0 * Math.cos(c) - p.y * this.sinlat0 * Math.sin(c)));
            }
            p.x = lon;
            p.y = lat;
            return p;
          } else {
            if (Math.abs(this.coslat0) <= EPSLN) {
              if (rh <= EPSLN) {
                lat = this.lat0;
                lon = this.long0;
                p.x = lon;
                p.y = lat;
                //trace(p.toString());
                return p;
              }
              p.x *= this.con;
              p.y *= this.con;
              ts = rh * this.cons / (2 * this.a * this.k0);
              lat = this.con * phi2z(this.e, ts);
              lon = this.con * adjust_lon(this.con * this.long0 + Math.atan2(p.x, -1 * p.y));
            } else {
              ce = 2 * Math.atan(rh * this.cosX0 / (2 * this.a * this.k0 * this.ms1));
              lon = this.long0;
              if (rh <= EPSLN) {
                Chi = this.X0;
              } else {
                Chi = Math.asin(Math.cos(ce) * this.sinX0 + p.y * Math.sin(ce) * this.cosX0 / rh);
                lon = adjust_lon(this.long0 + Math.atan2(p.x * Math.sin(ce), rh * this.cosX0 * Math.cos(ce) - p.y * this.sinX0 * Math.sin(ce)));
              }
              lat = -1 * phi2z(this.e, Math.tan(0.5 * (HALF_PI + Chi)));
            }
          }
          p.x = lon;
          p.y = lat;

          //trace(p.toString());
          return p;

        }

        var names$8 = ["stere", "Stereographic_South_Pole", "Polar Stereographic (variant B)"];
        var stere = {
          init: init$7,
          forward: forward$6,
          inverse: inverse$6,
          names: names$8,
          ssfn_: ssfn_
        };

        /*
          references:
            Formules et constantes pour le Calcul pour la
            projection cylindrique conforme à axe oblique et pour la transformation entre
            des systèmes de référence.
            http://www.swisstopo.admin.ch/internet/swisstopo/fr/home/topics/survey/sys/refsys/switzerland.parsysrelated1.31216.downloadList.77004.DownloadFile.tmp/swissprojectionfr.pdf
          */

        function init$8() {
          var phy0 = this.lat0;
          this.lambda0 = this.long0;
          var sinPhy0 = Math.sin(phy0);
          var semiMajorAxis = this.a;
          var invF = this.rf;
          var flattening = 1 / invF;
          var e2 = 2 * flattening - Math.pow(flattening, 2);
          var e = this.e = Math.sqrt(e2);
          this.R = this.k0 * semiMajorAxis * Math.sqrt(1 - e2) / (1 - e2 * Math.pow(sinPhy0, 2));
          this.alpha = Math.sqrt(1 + e2 / (1 - e2) * Math.pow(Math.cos(phy0), 4));
          this.b0 = Math.asin(sinPhy0 / this.alpha);
          var k1 = Math.log(Math.tan(Math.PI / 4 + this.b0 / 2));
          var k2 = Math.log(Math.tan(Math.PI / 4 + phy0 / 2));
          var k3 = Math.log((1 + e * sinPhy0) / (1 - e * sinPhy0));
          this.K = k1 - this.alpha * k2 + this.alpha * e / 2 * k3;
        }

        function forward$7(p) {
          var Sa1 = Math.log(Math.tan(Math.PI / 4 - p.y / 2));
          var Sa2 = this.e / 2 * Math.log((1 + this.e * Math.sin(p.y)) / (1 - this.e * Math.sin(p.y)));
          var S = -this.alpha * (Sa1 + Sa2) + this.K;

          // spheric latitude
          var b = 2 * (Math.atan(Math.exp(S)) - Math.PI / 4);

          // spheric longitude
          var I = this.alpha * (p.x - this.lambda0);

          // psoeudo equatorial rotation
          var rotI = Math.atan(Math.sin(I) / (Math.sin(this.b0) * Math.tan(b) + Math.cos(this.b0) * Math.cos(I)));

          var rotB = Math.asin(Math.cos(this.b0) * Math.sin(b) - Math.sin(this.b0) * Math.cos(b) * Math.cos(I));

          p.y = this.R / 2 * Math.log((1 + Math.sin(rotB)) / (1 - Math.sin(rotB))) + this.y0;
          p.x = this.R * rotI + this.x0;
          return p;
        }

        function inverse$7(p) {
          var Y = p.x - this.x0;
          var X = p.y - this.y0;

          var rotI = Y / this.R;
          var rotB = 2 * (Math.atan(Math.exp(X / this.R)) - Math.PI / 4);

          var b = Math.asin(Math.cos(this.b0) * Math.sin(rotB) + Math.sin(this.b0) * Math.cos(rotB) * Math.cos(rotI));
          var I = Math.atan(Math.sin(rotI) / (Math.cos(this.b0) * Math.cos(rotI) - Math.sin(this.b0) * Math.tan(rotB)));

          var lambda = this.lambda0 + I / this.alpha;

          var S = 0;
          var phy = b;
          var prevPhy = -1000;
          var iteration = 0;
          while (Math.abs(phy - prevPhy) > 0.0000001) {
            if (++iteration > 20) {
              //...reportError("omercFwdInfinity");
              return;
            }
            //S = Math.log(Math.tan(Math.PI / 4 + phy / 2));
            S = 1 / this.alpha * (Math.log(Math.tan(Math.PI / 4 + b / 2)) - this.K) + this.e * Math.log(Math.tan(Math.PI / 4 + Math.asin(this.e * Math.sin(phy)) / 2));
            prevPhy = phy;
            phy = 2 * Math.atan(Math.exp(S)) - Math.PI / 2;
          }

          p.x = lambda;
          p.y = phy;
          return p;
        }

        var names$9 = ["somerc"];
        var somerc = {
          init: init$8,
          forward: forward$7,
          inverse: inverse$7,
          names: names$9
        };

        /* Initialize the Oblique Mercator  projection
            ------------------------------------------*/
        function init$9() {
          this.no_off = this.no_off || false;
          this.no_rot = this.no_rot || false;

          if (isNaN(this.k0)) {
            this.k0 = 1;
          }
          var sinlat = Math.sin(this.lat0);
          var coslat = Math.cos(this.lat0);
          var con = this.e * sinlat;

          this.bl = Math.sqrt(1 + this.es / (1 - this.es) * Math.pow(coslat, 4));
          this.al = this.a * this.bl * this.k0 * Math.sqrt(1 - this.es) / (1 - con * con);
          var t0 = tsfnz(this.e, this.lat0, sinlat);
          var dl = this.bl / coslat * Math.sqrt((1 - this.es) / (1 - con * con));
          if (dl * dl < 1) {
            dl = 1;
          }
          var fl;
          var gl;
          if (!isNaN(this.longc)) {
            //Central point and azimuth method

            if (this.lat0 >= 0) {
              fl = dl + Math.sqrt(dl * dl - 1);
            } else {
              fl = dl - Math.sqrt(dl * dl - 1);
            }
            this.el = fl * Math.pow(t0, this.bl);
            gl = 0.5 * (fl - 1 / fl);
            this.gamma0 = Math.asin(Math.sin(this.alpha) / dl);
            this.long0 = this.longc - Math.asin(gl * Math.tan(this.gamma0)) / this.bl;

          } else {
            //2 points method
            var t1 = tsfnz(this.e, this.lat1, Math.sin(this.lat1));
            var t2 = tsfnz(this.e, this.lat2, Math.sin(this.lat2));
            if (this.lat0 >= 0) {
              this.el = (dl + Math.sqrt(dl * dl - 1)) * Math.pow(t0, this.bl);
            } else {
              this.el = (dl - Math.sqrt(dl * dl - 1)) * Math.pow(t0, this.bl);
            }
            var hl = Math.pow(t1, this.bl);
            var ll = Math.pow(t2, this.bl);
            fl = this.el / hl;
            gl = 0.5 * (fl - 1 / fl);
            var jl = (this.el * this.el - ll * hl) / (this.el * this.el + ll * hl);
            var pl = (ll - hl) / (ll + hl);
            var dlon12 = adjust_lon(this.long1 - this.long2);
            this.long0 = 0.5 * (this.long1 + this.long2) - Math.atan(jl * Math.tan(0.5 * this.bl * (dlon12)) / pl) / this.bl;
            this.long0 = adjust_lon(this.long0);
            var dlon10 = adjust_lon(this.long1 - this.long0);
            this.gamma0 = Math.atan(Math.sin(this.bl * (dlon10)) / gl);
            this.alpha = Math.asin(dl * Math.sin(this.gamma0));
          }

          if (this.no_off) {
            this.uc = 0;
          } else {
            if (this.lat0 >= 0) {
              this.uc = this.al / this.bl * Math.atan2(Math.sqrt(dl * dl - 1), Math.cos(this.alpha));
            } else {
              this.uc = -1 * this.al / this.bl * Math.atan2(Math.sqrt(dl * dl - 1), Math.cos(this.alpha));
            }
          }

        }

        /* Oblique Mercator forward equations--mapping lat,long to x,y
            ----------------------------------------------------------*/
        function forward$8(p) {
          var lon = p.x;
          var lat = p.y;
          var dlon = adjust_lon(lon - this.long0);
          var us, vs;
          var con;
          if (Math.abs(Math.abs(lat) - HALF_PI) <= EPSLN) {
            if (lat > 0) {
              con = -1;
            } else {
              con = 1;
            }
            vs = this.al / this.bl * Math.log(Math.tan(FORTPI + con * this.gamma0 * 0.5));
            us = -1 * con * HALF_PI * this.al / this.bl;
          } else {
            var t = tsfnz(this.e, lat, Math.sin(lat));
            var ql = this.el / Math.pow(t, this.bl);
            var sl = 0.5 * (ql - 1 / ql);
            var tl = 0.5 * (ql + 1 / ql);
            var vl = Math.sin(this.bl * (dlon));
            var ul = (sl * Math.sin(this.gamma0) - vl * Math.cos(this.gamma0)) / tl;
            if (Math.abs(Math.abs(ul) - 1) <= EPSLN) {
              vs = Number.POSITIVE_INFINITY;
            } else {
              vs = 0.5 * this.al * Math.log((1 - ul) / (1 + ul)) / this.bl;
            }
            if (Math.abs(Math.cos(this.bl * (dlon))) <= EPSLN) {
              us = this.al * this.bl * (dlon);
            } else {
              us = this.al * Math.atan2(sl * Math.cos(this.gamma0) + vl * Math.sin(this.gamma0), Math.cos(this.bl * dlon)) / this.bl;
            }
          }

          if (this.no_rot) {
            p.x = this.x0 + us;
            p.y = this.y0 + vs;
          } else {

            us -= this.uc;
            p.x = this.x0 + vs * Math.cos(this.alpha) + us * Math.sin(this.alpha);
            p.y = this.y0 + us * Math.cos(this.alpha) - vs * Math.sin(this.alpha);
          }
          return p;
        }

        function inverse$8(p) {
          var us, vs;
          if (this.no_rot) {
            vs = p.y - this.y0;
            us = p.x - this.x0;
          } else {
            vs = (p.x - this.x0) * Math.cos(this.alpha) - (p.y - this.y0) * Math.sin(this.alpha);
            us = (p.y - this.y0) * Math.cos(this.alpha) + (p.x - this.x0) * Math.sin(this.alpha);
            us += this.uc;
          }
          var qp = Math.exp(-1 * this.bl * vs / this.al);
          var sp = 0.5 * (qp - 1 / qp);
          var tp = 0.5 * (qp + 1 / qp);
          var vp = Math.sin(this.bl * us / this.al);
          var up = (vp * Math.cos(this.gamma0) + sp * Math.sin(this.gamma0)) / tp;
          var ts = Math.pow(this.el / Math.sqrt((1 + up) / (1 - up)), 1 / this.bl);
          if (Math.abs(up - 1) < EPSLN) {
            p.x = this.long0;
            p.y = HALF_PI;
          } else if (Math.abs(up + 1) < EPSLN) {
            p.x = this.long0;
            p.y = -1 * HALF_PI;
          } else {
            p.y = phi2z(this.e, ts);
            p.x = adjust_lon(this.long0 - Math.atan2(sp * Math.cos(this.gamma0) - vp * Math.sin(this.gamma0), Math.cos(this.bl * us / this.al)) / this.bl);
          }
          return p;
        }

        var names$10 = ["Hotine_Oblique_Mercator", "Hotine Oblique Mercator", "Hotine_Oblique_Mercator_Azimuth_Natural_Origin", "Hotine_Oblique_Mercator_Azimuth_Center", "omerc"];
        var omerc = {
          init: init$9,
          forward: forward$8,
          inverse: inverse$8,
          names: names$10
        };

        function init$10() {

          // array of:  r_maj,r_min,lat1,lat2,c_lon,c_lat,false_east,false_north
          //double c_lat;                   /* center latitude                      */
          //double c_lon;                   /* center longitude                     */
          //double lat1;                    /* first standard parallel              */
          //double lat2;                    /* second standard parallel             */
          //double r_maj;                   /* major axis                           */
          //double r_min;                   /* minor axis                           */
          //double false_east;              /* x offset in meters                   */
          //double false_north;             /* y offset in meters                   */

          if (!this.lat2) {
            this.lat2 = this.lat1;
          } //if lat2 is not defined
          if (!this.k0) {
            this.k0 = 1;
          }
          this.x0 = this.x0 || 0;
          this.y0 = this.y0 || 0;
          // Standard Parallels cannot be equal and on opposite sides of the equator
          if (Math.abs(this.lat1 + this.lat2) < EPSLN) {
            return;
          }

          var temp = this.b / this.a;
          this.e = Math.sqrt(1 - temp * temp);

          var sin1 = Math.sin(this.lat1);
          var cos1 = Math.cos(this.lat1);
          var ms1 = msfnz(this.e, sin1, cos1);
          var ts1 = tsfnz(this.e, this.lat1, sin1);

          var sin2 = Math.sin(this.lat2);
          var cos2 = Math.cos(this.lat2);
          var ms2 = msfnz(this.e, sin2, cos2);
          var ts2 = tsfnz(this.e, this.lat2, sin2);

          var ts0 = tsfnz(this.e, this.lat0, Math.sin(this.lat0));

          if (Math.abs(this.lat1 - this.lat2) > EPSLN) {
            this.ns = Math.log(ms1 / ms2) / Math.log(ts1 / ts2);
          } else {
            this.ns = sin1;
          }
          if (isNaN(this.ns)) {
            this.ns = sin1;
          }
          this.f0 = ms1 / (this.ns * Math.pow(ts1, this.ns));
          this.rh = this.a * this.f0 * Math.pow(ts0, this.ns);
          if (!this.title) {
            this.title = "Lambert Conformal Conic";
          }
        }

        // Lambert Conformal conic forward equations--mapping lat,long to x,y
        // -----------------------------------------------------------------
        function forward$9(p) {

          var lon = p.x;
          var lat = p.y;

          // singular cases :
          if (Math.abs(2 * Math.abs(lat) - Math.PI) <= EPSLN) {
            lat = sign(lat) * (HALF_PI - 2 * EPSLN);
          }

          var con = Math.abs(Math.abs(lat) - HALF_PI);
          var ts, rh1;
          if (con > EPSLN) {
            ts = tsfnz(this.e, lat, Math.sin(lat));
            rh1 = this.a * this.f0 * Math.pow(ts, this.ns);
          } else {
            con = lat * this.ns;
            if (con <= 0) {
              return null;
            }
            rh1 = 0;
          }
          var theta = this.ns * adjust_lon(lon - this.long0);
          p.x = this.k0 * (rh1 * Math.sin(theta)) + this.x0;
          p.y = this.k0 * (this.rh - rh1 * Math.cos(theta)) + this.y0;

          return p;
        }

        // Lambert Conformal Conic inverse equations--mapping x,y to lat/long
        // -----------------------------------------------------------------
        function inverse$9(p) {

          var rh1, con, ts;
          var lat, lon;
          var x = (p.x - this.x0) / this.k0;
          var y = (this.rh - (p.y - this.y0) / this.k0);
          if (this.ns > 0) {
            rh1 = Math.sqrt(x * x + y * y);
            con = 1;
          } else {
            rh1 = -Math.sqrt(x * x + y * y);
            con = -1;
          }
          var theta = 0;
          if (rh1 !== 0) {
            theta = Math.atan2((con * x), (con * y));
          }
          if ((rh1 !== 0) || (this.ns > 0)) {
            con = 1 / this.ns;
            ts = Math.pow((rh1 / (this.a * this.f0)), con);
            lat = phi2z(this.e, ts);
            if (lat === -9999) {
              return null;
            }
          } else {
            lat = -HALF_PI;
          }
          lon = adjust_lon(theta / this.ns + this.long0);

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$11 = ["Lambert Tangential Conformal Conic Projection", "Lambert_Conformal_Conic", "Lambert_Conformal_Conic_2SP", "lcc"];
        var lcc = {
          init: init$10,
          forward: forward$9,
          inverse: inverse$9,
          names: names$11
        };

        function init$11() {
          this.a = 6377397.155;
          this.es = 0.006674372230614;
          this.e = Math.sqrt(this.es);
          if (!this.lat0) {
            this.lat0 = 0.863937979737193;
          }
          if (!this.long0) {
            this.long0 = 0.7417649320975901 - 0.308341501185665;
          }
          /* if scale not set default to 0.9999 */
          if (!this.k0) {
            this.k0 = 0.9999;
          }
          this.s45 = 0.785398163397448; /* 45 */
          this.s90 = 2 * this.s45;
          this.fi0 = this.lat0;
          this.e2 = this.es;
          this.e = Math.sqrt(this.e2);
          this.alfa = Math.sqrt(1 + (this.e2 * Math.pow(Math.cos(this.fi0), 4)) / (1 - this.e2));
          this.uq = 1.04216856380474;
          this.u0 = Math.asin(Math.sin(this.fi0) / this.alfa);
          this.g = Math.pow((1 + this.e * Math.sin(this.fi0)) / (1 - this.e * Math.sin(this.fi0)), this.alfa * this.e / 2);
          this.k = Math.tan(this.u0 / 2 + this.s45) / Math.pow(Math.tan(this.fi0 / 2 + this.s45), this.alfa) * this.g;
          this.k1 = this.k0;
          this.n0 = this.a * Math.sqrt(1 - this.e2) / (1 - this.e2 * Math.pow(Math.sin(this.fi0), 2));
          this.s0 = 1.37008346281555;
          this.n = Math.sin(this.s0);
          this.ro0 = this.k1 * this.n0 / Math.tan(this.s0);
          this.ad = this.s90 - this.uq;
        }

        /* ellipsoid */
        /* calculate xy from lat/lon */
        /* Constants, identical to inverse transform function */
        function forward$10(p) {
          var gfi, u, deltav, s, d, eps, ro;
          var lon = p.x;
          var lat = p.y;
          var delta_lon = adjust_lon(lon - this.long0);
          /* Transformation */
          gfi = Math.pow(((1 + this.e * Math.sin(lat)) / (1 - this.e * Math.sin(lat))), (this.alfa * this.e / 2));
          u = 2 * (Math.atan(this.k * Math.pow(Math.tan(lat / 2 + this.s45), this.alfa) / gfi) - this.s45);
          deltav = -delta_lon * this.alfa;
          s = Math.asin(Math.cos(this.ad) * Math.sin(u) + Math.sin(this.ad) * Math.cos(u) * Math.cos(deltav));
          d = Math.asin(Math.cos(u) * Math.sin(deltav) / Math.cos(s));
          eps = this.n * d;
          ro = this.ro0 * Math.pow(Math.tan(this.s0 / 2 + this.s45), this.n) / Math.pow(Math.tan(s / 2 + this.s45), this.n);
          p.y = ro * Math.cos(eps) / 1;
          p.x = ro * Math.sin(eps) / 1;

          if (!this.czech) {
            p.y *= -1;
            p.x *= -1;
          }
          return (p);
        }

        /* calculate lat/lon from xy */
        function inverse$10(p) {
          var u, deltav, s, d, eps, ro, fi1;
          var ok;

          /* Transformation */
          /* revert y, x*/
          var tmp = p.x;
          p.x = p.y;
          p.y = tmp;
          if (!this.czech) {
            p.y *= -1;
            p.x *= -1;
          }
          ro = Math.sqrt(p.x * p.x + p.y * p.y);
          eps = Math.atan2(p.y, p.x);
          d = eps / Math.sin(this.s0);
          s = 2 * (Math.atan(Math.pow(this.ro0 / ro, 1 / this.n) * Math.tan(this.s0 / 2 + this.s45)) - this.s45);
          u = Math.asin(Math.cos(this.ad) * Math.sin(s) - Math.sin(this.ad) * Math.cos(s) * Math.cos(d));
          deltav = Math.asin(Math.cos(s) * Math.sin(d) / Math.cos(u));
          p.x = this.long0 - deltav / this.alfa;
          fi1 = u;
          ok = 0;
          var iter = 0;
          do {
            p.y = 2 * (Math.atan(Math.pow(this.k, -1 / this.alfa) * Math.pow(Math.tan(u / 2 + this.s45), 1 / this.alfa) * Math.pow((1 + this.e * Math.sin(fi1)) / (1 - this.e * Math.sin(fi1)), this.e / 2)) - this.s45);
            if (Math.abs(fi1 - p.y) < 0.0000000001) {
              ok = 1;
            }
            fi1 = p.y;
            iter += 1;
          } while (ok === 0 && iter < 15);
          if (iter >= 15) {
            return null;
          }

          return (p);
        }

        var names$12 = ["Krovak", "krovak"];
        var krovak = {
          init: init$11,
          forward: forward$10,
          inverse: inverse$10,
          names: names$12
        };

        var mlfn = function (e0, e1, e2, e3, phi) {
          return (e0 * phi - e1 * Math.sin(2 * phi) + e2 * Math.sin(4 * phi) - e3 * Math.sin(6 * phi));
        };

        var e0fn = function (x) {
          return (1 - 0.25 * x * (1 + x / 16 * (3 + 1.25 * x)));
        };

        var e1fn = function (x) {
          return (0.375 * x * (1 + 0.25 * x * (1 + 0.46875 * x)));
        };

        var e2fn = function (x) {
          return (0.05859375 * x * x * (1 + 0.75 * x));
        };

        var e3fn = function (x) {
          return (x * x * x * (35 / 3072));
        };

        var gN = function (a, e, sinphi) {
          var temp = e * sinphi;
          return a / Math.sqrt(1 - temp * temp);
        };

        var adjust_lat = function (x) {
          return (Math.abs(x) < HALF_PI) ? x : (x - (sign(x) * Math.PI));
        };

        var imlfn = function (ml, e0, e1, e2, e3) {
          var phi;
          var dphi;

          phi = ml / e0;
          for (var i = 0; i < 15; i++) {
            dphi = (ml - (e0 * phi - e1 * Math.sin(2 * phi) + e2 * Math.sin(4 * phi) - e3 * Math.sin(6 * phi))) / (e0 - 2 * e1 * Math.cos(2 * phi) + 4 * e2 * Math.cos(4 * phi) - 6 * e3 * Math.cos(6 * phi));
            phi += dphi;
            if (Math.abs(dphi) <= 0.0000000001) {
              return phi;
            }
          }

          //..reportError("IMLFN-CONV:Latitude failed to converge after 15 iterations");
          return NaN;
        };

        function init$12() {
          if (!this.sphere) {
            this.e0 = e0fn(this.es);
            this.e1 = e1fn(this.es);
            this.e2 = e2fn(this.es);
            this.e3 = e3fn(this.es);
            this.ml0 = this.a * mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
          }
        }

        /* Cassini forward equations--mapping lat,long to x,y
          -----------------------------------------------------------------------*/
        function forward$11(p) {

          /* Forward equations
              -----------------*/
          var x, y;
          var lam = p.x;
          var phi = p.y;
          lam = adjust_lon(lam - this.long0);

          if (this.sphere) {
            x = this.a * Math.asin(Math.cos(phi) * Math.sin(lam));
            y = this.a * (Math.atan2(Math.tan(phi), Math.cos(lam)) - this.lat0);
          } else {
            //ellipsoid
            var sinphi = Math.sin(phi);
            var cosphi = Math.cos(phi);
            var nl = gN(this.a, this.e, sinphi);
            var tl = Math.tan(phi) * Math.tan(phi);
            var al = lam * Math.cos(phi);
            var asq = al * al;
            var cl = this.es * cosphi * cosphi / (1 - this.es);
            var ml = this.a * mlfn(this.e0, this.e1, this.e2, this.e3, phi);

            x = nl * al * (1 - asq * tl * (1 / 6 - (8 - tl + 8 * cl) * asq / 120));
            y = ml - this.ml0 + nl * sinphi / cosphi * asq * (0.5 + (5 - tl + 6 * cl) * asq / 24);


          }

          p.x = x + this.x0;
          p.y = y + this.y0;
          return p;
        }

        /* Inverse equations
          -----------------*/
        function inverse$11(p) {
          p.x -= this.x0;
          p.y -= this.y0;
          var x = p.x / this.a;
          var y = p.y / this.a;
          var phi, lam;

          if (this.sphere) {
            var dd = y + this.lat0;
            phi = Math.asin(Math.sin(dd) * Math.cos(x));
            lam = Math.atan2(Math.tan(x), Math.cos(dd));
          } else {
            /* ellipsoid */
            var ml1 = this.ml0 / this.a + y;
            var phi1 = imlfn(ml1, this.e0, this.e1, this.e2, this.e3);
            if (Math.abs(Math.abs(phi1) - HALF_PI) <= EPSLN) {
              p.x = this.long0;
              p.y = HALF_PI;
              if (y < 0) {
                p.y *= -1;
              }
              return p;
            }
            var nl1 = gN(this.a, this.e, Math.sin(phi1));

            var rl1 = nl1 * nl1 * nl1 / this.a / this.a * (1 - this.es);
            var tl1 = Math.pow(Math.tan(phi1), 2);
            var dl = x * this.a / nl1;
            var dsq = dl * dl;
            phi = phi1 - nl1 * Math.tan(phi1) / rl1 * dl * dl * (0.5 - (1 + 3 * tl1) * dl * dl / 24);
            lam = dl * (1 - dsq * (tl1 / 3 + (1 + 3 * tl1) * tl1 * dsq / 15)) / Math.cos(phi1);

          }

          p.x = adjust_lon(lam + this.long0);
          p.y = adjust_lat(phi);
          return p;

        }

        var names$13 = ["Cassini", "Cassini_Soldner", "cass"];
        var cass = {
          init: init$12,
          forward: forward$11,
          inverse: inverse$11,
          names: names$13
        };

        var qsfnz = function (eccent, sinphi) {
          var con;
          if (eccent > 1.0e-7) {
            con = eccent * sinphi;
            return ((1 - eccent * eccent) * (sinphi / (1 - con * con) - (0.5 / eccent) * Math.log((1 - con) / (1 + con))));
          } else {
            return (2 * sinphi);
          }
        };

        /*
          reference
            "New Equal-Area Map Projections for Noncircular Regions", John P. Snyder,
            The American Cartographer, Vol 15, No. 4, October 1988, pp. 341-355.
          */

        var S_POLE = 1;

        var N_POLE = 2;
        var EQUIT = 3;
        var OBLIQ = 4;

        /* Initialize the Lambert Azimuthal Equal Area projection
          ------------------------------------------------------*/
        function init$13() {
          var t = Math.abs(this.lat0);
          if (Math.abs(t - HALF_PI) < EPSLN) {
            this.mode = this.lat0 < 0 ? this.S_POLE : this.N_POLE;
          } else if (Math.abs(t) < EPSLN) {
            this.mode = this.EQUIT;
          } else {
            this.mode = this.OBLIQ;
          }
          if (this.es > 0) {
            var sinphi;

            this.qp = qsfnz(this.e, 1);
            this.mmf = 0.5 / (1 - this.es);
            this.apa = authset(this.es);
            switch (this.mode) {
              case this.N_POLE:
                this.dd = 1;
                break;
              case this.S_POLE:
                this.dd = 1;
                break;
              case this.EQUIT:
                this.rq = Math.sqrt(0.5 * this.qp);
                this.dd = 1 / this.rq;
                this.xmf = 1;
                this.ymf = 0.5 * this.qp;
                break;
              case this.OBLIQ:
                this.rq = Math.sqrt(0.5 * this.qp);
                sinphi = Math.sin(this.lat0);
                this.sinb1 = qsfnz(this.e, sinphi) / this.qp;
                this.cosb1 = Math.sqrt(1 - this.sinb1 * this.sinb1);
                this.dd = Math.cos(this.lat0) / (Math.sqrt(1 - this.es * sinphi * sinphi) * this.rq * this.cosb1);
                this.ymf = (this.xmf = this.rq) / this.dd;
                this.xmf *= this.dd;
                break;
            }
          } else {
            if (this.mode === this.OBLIQ) {
              this.sinph0 = Math.sin(this.lat0);
              this.cosph0 = Math.cos(this.lat0);
            }
          }
        }

        /* Lambert Azimuthal Equal Area forward equations--mapping lat,long to x,y
          -----------------------------------------------------------------------*/
        function forward$12(p) {

          /* Forward equations
              -----------------*/
          var x, y, coslam, sinlam, sinphi, q, sinb, cosb, b, cosphi;
          var lam = p.x;
          var phi = p.y;

          lam = adjust_lon(lam - this.long0);
          if (this.sphere) {
            sinphi = Math.sin(phi);
            cosphi = Math.cos(phi);
            coslam = Math.cos(lam);
            if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
              y = (this.mode === this.EQUIT) ? 1 + cosphi * coslam : 1 + this.sinph0 * sinphi + this.cosph0 * cosphi * coslam;
              if (y <= EPSLN) {
                return null;
              }
              y = Math.sqrt(2 / y);
              x = y * cosphi * Math.sin(lam);
              y *= (this.mode === this.EQUIT) ? sinphi : this.cosph0 * sinphi - this.sinph0 * cosphi * coslam;
            } else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
              if (this.mode === this.N_POLE) {
                coslam = -coslam;
              }
              if (Math.abs(phi + this.phi0) < EPSLN) {
                return null;
              }
              y = FORTPI - phi * 0.5;
              y = 2 * ((this.mode === this.S_POLE) ? Math.cos(y) : Math.sin(y));
              x = y * Math.sin(lam);
              y *= coslam;
            }
          } else {
            sinb = 0;
            cosb = 0;
            b = 0;
            coslam = Math.cos(lam);
            sinlam = Math.sin(lam);
            sinphi = Math.sin(phi);
            q = qsfnz(this.e, sinphi);
            if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
              sinb = q / this.qp;
              cosb = Math.sqrt(1 - sinb * sinb);
            }
            switch (this.mode) {
              case this.OBLIQ:
                b = 1 + this.sinb1 * sinb + this.cosb1 * cosb * coslam;
                break;
              case this.EQUIT:
                b = 1 + cosb * coslam;
                break;
              case this.N_POLE:
                b = HALF_PI + phi;
                q = this.qp - q;
                break;
              case this.S_POLE:
                b = phi - HALF_PI;
                q = this.qp + q;
                break;
            }
            if (Math.abs(b) < EPSLN) {
              return null;
            }
            switch (this.mode) {
              case this.OBLIQ:
              case this.EQUIT:
                b = Math.sqrt(2 / b);
                if (this.mode === this.OBLIQ) {
                  y = this.ymf * b * (this.cosb1 * sinb - this.sinb1 * cosb * coslam);
                } else {
                  y = (b = Math.sqrt(2 / (1 + cosb * coslam))) * sinb * this.ymf;
                }
                x = this.xmf * b * cosb * sinlam;
                break;
              case this.N_POLE:
              case this.S_POLE:
                if (q >= 0) {
                  x = (b = Math.sqrt(q)) * sinlam;
                  y = coslam * ((this.mode === this.S_POLE) ? b : -b);
                } else {
                  x = y = 0;
                }
                break;
            }
          }

          p.x = this.a * x + this.x0;
          p.y = this.a * y + this.y0;
          return p;
        }

        /* Inverse equations
          -----------------*/
        function inverse$12(p) {
          p.x -= this.x0;
          p.y -= this.y0;
          var x = p.x / this.a;
          var y = p.y / this.a;
          var lam, phi, cCe, sCe, q, rho, ab;
          if (this.sphere) {
            var cosz = 0,
              rh, sinz = 0;

            rh = Math.sqrt(x * x + y * y);
            phi = rh * 0.5;
            if (phi > 1) {
              return null;
            }
            phi = 2 * Math.asin(phi);
            if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
              sinz = Math.sin(phi);
              cosz = Math.cos(phi);
            }
            switch (this.mode) {
              case this.EQUIT:
                phi = (Math.abs(rh) <= EPSLN) ? 0 : Math.asin(y * sinz / rh);
                x *= sinz;
                y = cosz * rh;
                break;
              case this.OBLIQ:
                phi = (Math.abs(rh) <= EPSLN) ? this.phi0 : Math.asin(cosz * this.sinph0 + y * sinz * this.cosph0 / rh);
                x *= sinz * this.cosph0;
                y = (cosz - Math.sin(phi) * this.sinph0) * rh;
                break;
              case this.N_POLE:
                y = -y;
                phi = HALF_PI - phi;
                break;
              case this.S_POLE:
                phi -= HALF_PI;
                break;
            }
            lam = (y === 0 && (this.mode === this.EQUIT || this.mode === this.OBLIQ)) ? 0 : Math.atan2(x, y);
          } else {
            ab = 0;
            if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
              x /= this.dd;
              y *= this.dd;
              rho = Math.sqrt(x * x + y * y);
              if (rho < EPSLN) {
                p.x = 0;
                p.y = this.phi0;
                return p;
              }
              sCe = 2 * Math.asin(0.5 * rho / this.rq);
              cCe = Math.cos(sCe);
              x *= (sCe = Math.sin(sCe));
              if (this.mode === this.OBLIQ) {
                ab = cCe * this.sinb1 + y * sCe * this.cosb1 / rho;
                q = this.qp * ab;
                y = rho * this.cosb1 * cCe - y * this.sinb1 * sCe;
              } else {
                ab = y * sCe / rho;
                q = this.qp * ab;
                y = rho * cCe;
              }
            } else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
              if (this.mode === this.N_POLE) {
                y = -y;
              }
              q = (x * x + y * y);
              if (!q) {
                p.x = 0;
                p.y = this.phi0;
                return p;
              }
              ab = 1 - q / this.qp;
              if (this.mode === this.S_POLE) {
                ab = -ab;
              }
            }
            lam = Math.atan2(x, y);
            phi = authlat(Math.asin(ab), this.apa);
          }

          p.x = adjust_lon(this.long0 + lam);
          p.y = phi;
          return p;
        }

        /* determine latitude from authalic latitude */
        var P00 = 0.33333333333333333333;

        var P01 = 0.17222222222222222222;
        var P02 = 0.10257936507936507936;
        var P10 = 0.06388888888888888888;
        var P11 = 0.06640211640211640211;
        var P20 = 0.01641501294219154443;

        function authset(es) {
          var t;
          var APA = [];
          APA[0] = es * P00;
          t = es * es;
          APA[0] += t * P01;
          APA[1] = t * P10;
          t *= es;
          APA[0] += t * P02;
          APA[1] += t * P11;
          APA[2] = t * P20;
          return APA;
        }

        function authlat(beta, APA) {
          var t = beta + beta;
          return (beta + APA[0] * Math.sin(t) + APA[1] * Math.sin(t + t) + APA[2] * Math.sin(t + t + t));
        }

        var names$14 = ["Lambert Azimuthal Equal Area", "Lambert_Azimuthal_Equal_Area", "laea"];
        var laea = {
          init: init$13,
          forward: forward$12,
          inverse: inverse$12,
          names: names$14,
          S_POLE: S_POLE,
          N_POLE: N_POLE,
          EQUIT: EQUIT,
          OBLIQ: OBLIQ
        };

        var asinz = function (x) {
          if (Math.abs(x) > 1) {
            x = (x > 1) ? 1 : -1;
          }
          return Math.asin(x);
        };

        function init$14() {

          if (Math.abs(this.lat1 + this.lat2) < EPSLN) {
            return;
          }
          this.temp = this.b / this.a;
          this.es = 1 - Math.pow(this.temp, 2);
          this.e3 = Math.sqrt(this.es);

          this.sin_po = Math.sin(this.lat1);
          this.cos_po = Math.cos(this.lat1);
          this.t1 = this.sin_po;
          this.con = this.sin_po;
          this.ms1 = msfnz(this.e3, this.sin_po, this.cos_po);
          this.qs1 = qsfnz(this.e3, this.sin_po, this.cos_po);

          this.sin_po = Math.sin(this.lat2);
          this.cos_po = Math.cos(this.lat2);
          this.t2 = this.sin_po;
          this.ms2 = msfnz(this.e3, this.sin_po, this.cos_po);
          this.qs2 = qsfnz(this.e3, this.sin_po, this.cos_po);

          this.sin_po = Math.sin(this.lat0);
          this.cos_po = Math.cos(this.lat0);
          this.t3 = this.sin_po;
          this.qs0 = qsfnz(this.e3, this.sin_po, this.cos_po);

          if (Math.abs(this.lat1 - this.lat2) > EPSLN) {
            this.ns0 = (this.ms1 * this.ms1 - this.ms2 * this.ms2) / (this.qs2 - this.qs1);
          } else {
            this.ns0 = this.con;
          }
          this.c = this.ms1 * this.ms1 + this.ns0 * this.qs1;
          this.rh = this.a * Math.sqrt(this.c - this.ns0 * this.qs0) / this.ns0;
        }

        /* Albers Conical Equal Area forward equations--mapping lat,long to x,y
          -------------------------------------------------------------------*/
        function forward$13(p) {

          var lon = p.x;
          var lat = p.y;

          this.sin_phi = Math.sin(lat);
          this.cos_phi = Math.cos(lat);

          var qs = qsfnz(this.e3, this.sin_phi, this.cos_phi);
          var rh1 = this.a * Math.sqrt(this.c - this.ns0 * qs) / this.ns0;
          var theta = this.ns0 * adjust_lon(lon - this.long0);
          var x = rh1 * Math.sin(theta) + this.x0;
          var y = this.rh - rh1 * Math.cos(theta) + this.y0;

          p.x = x;
          p.y = y;
          return p;
        }

        function inverse$13(p) {
          var rh1, qs, con, theta, lon, lat;

          p.x -= this.x0;
          p.y = this.rh - p.y + this.y0;
          if (this.ns0 >= 0) {
            rh1 = Math.sqrt(p.x * p.x + p.y * p.y);
            con = 1;
          } else {
            rh1 = -Math.sqrt(p.x * p.x + p.y * p.y);
            con = -1;
          }
          theta = 0;
          if (rh1 !== 0) {
            theta = Math.atan2(con * p.x, con * p.y);
          }
          con = rh1 * this.ns0 / this.a;
          if (this.sphere) {
            lat = Math.asin((this.c - con * con) / (2 * this.ns0));
          } else {
            qs = (this.c - con * con) / this.ns0;
            lat = this.phi1z(this.e3, qs);
          }

          lon = adjust_lon(theta / this.ns0 + this.long0);
          p.x = lon;
          p.y = lat;
          return p;
        }

        /* Function to compute phi1, the latitude for the inverse of the
           Albers Conical Equal-Area projection.
        -------------------------------------------*/
        function phi1z(eccent, qs) {
          var sinphi, cosphi, con, com, dphi;
          var phi = asinz(0.5 * qs);
          if (eccent < EPSLN) {
            return phi;
          }

          var eccnts = eccent * eccent;
          for (var i = 1; i <= 25; i++) {
            sinphi = Math.sin(phi);
            cosphi = Math.cos(phi);
            con = eccent * sinphi;
            com = 1 - con * con;
            dphi = 0.5 * com * com / cosphi * (qs / (1 - eccnts) - sinphi / com + 0.5 / eccent * Math.log((1 - con) / (1 + con)));
            phi = phi + dphi;
            if (Math.abs(dphi) <= 1e-7) {
              return phi;
            }
          }
          return null;
        }

        var names$15 = ["Albers_Conic_Equal_Area", "Albers", "aea"];
        var aea = {
          init: init$14,
          forward: forward$13,
          inverse: inverse$13,
          names: names$15,
          phi1z: phi1z
        };

        /*
          reference:
            Wolfram Mathworld "Gnomonic Projection"
            http://mathworld.wolfram.com/GnomonicProjection.html
            Accessed: 12th November 2009
          */
        function init$15() {

          /* Place parameters in static storage for common use
              -------------------------------------------------*/
          this.sin_p14 = Math.sin(this.lat0);
          this.cos_p14 = Math.cos(this.lat0);
          // Approximation for projecting points to the horizon (infinity)
          this.infinity_dist = 1000 * this.a;
          this.rc = 1;
        }

        /* Gnomonic forward equations--mapping lat,long to x,y
            ---------------------------------------------------*/
        function forward$14(p) {
          var sinphi, cosphi; /* sin and cos value        */
          var dlon; /* delta longitude value      */
          var coslon; /* cos of longitude        */
          var ksp; /* scale factor          */
          var g;
          var x, y;
          var lon = p.x;
          var lat = p.y;
          /* Forward equations
              -----------------*/
          dlon = adjust_lon(lon - this.long0);

          sinphi = Math.sin(lat);
          cosphi = Math.cos(lat);

          coslon = Math.cos(dlon);
          g = this.sin_p14 * sinphi + this.cos_p14 * cosphi * coslon;
          ksp = 1;
          if ((g > 0) || (Math.abs(g) <= EPSLN)) {
            x = this.x0 + this.a * ksp * cosphi * Math.sin(dlon) / g;
            y = this.y0 + this.a * ksp * (this.cos_p14 * sinphi - this.sin_p14 * cosphi * coslon) / g;
          } else {

            // Point is in the opposing hemisphere and is unprojectable
            // We still need to return a reasonable point, so we project
            // to infinity, on a bearing
            // equivalent to the northern hemisphere equivalent
            // This is a reasonable approximation for short shapes and lines that
            // straddle the horizon.

            x = this.x0 + this.infinity_dist * cosphi * Math.sin(dlon);
            y = this.y0 + this.infinity_dist * (this.cos_p14 * sinphi - this.sin_p14 * cosphi * coslon);

          }
          p.x = x;
          p.y = y;
          return p;
        }

        function inverse$14(p) {
          var rh; /* Rho */
          var sinc, cosc;
          var c;
          var lon, lat;

          /* Inverse equations
              -----------------*/
          p.x = (p.x - this.x0) / this.a;
          p.y = (p.y - this.y0) / this.a;

          p.x /= this.k0;
          p.y /= this.k0;

          if ((rh = Math.sqrt(p.x * p.x + p.y * p.y))) {
            c = Math.atan2(rh, this.rc);
            sinc = Math.sin(c);
            cosc = Math.cos(c);

            lat = asinz(cosc * this.sin_p14 + (p.y * sinc * this.cos_p14) / rh);
            lon = Math.atan2(p.x * sinc, rh * this.cos_p14 * cosc - p.y * this.sin_p14 * sinc);
            lon = adjust_lon(this.long0 + lon);
          } else {
            lat = this.phic0;
            lon = 0;
          }

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$16 = ["gnom"];
        var gnom = {
          init: init$15,
          forward: forward$14,
          inverse: inverse$14,
          names: names$16
        };

        var iqsfnz = function (eccent, q) {
          var temp = 1 - (1 - eccent * eccent) / (2 * eccent) * Math.log((1 - eccent) / (1 + eccent));
          if (Math.abs(Math.abs(q) - temp) < 1.0E-6) {
            if (q < 0) {
              return (-1 * HALF_PI);
            } else {
              return HALF_PI;
            }
          }
          //var phi = 0.5* q/(1-eccent*eccent);
          var phi = Math.asin(0.5 * q);
          var dphi;
          var sin_phi;
          var cos_phi;
          var con;
          for (var i = 0; i < 30; i++) {
            sin_phi = Math.sin(phi);
            cos_phi = Math.cos(phi);
            con = eccent * sin_phi;
            dphi = Math.pow(1 - con * con, 2) / (2 * cos_phi) * (q / (1 - eccent * eccent) - sin_phi / (1 - con * con) + 0.5 / eccent * Math.log((1 - con) / (1 + con)));
            phi += dphi;
            if (Math.abs(dphi) <= 0.0000000001) {
              return phi;
            }
          }

          //console.log("IQSFN-CONV:Latitude failed to converge after 30 iterations");
          return NaN;
        };

        /*
          reference:
            "Cartographic Projection Procedures for the UNIX Environment-
            A User's Manual" by Gerald I. Evenden,
            USGS Open File Report 90-284and Release 4 Interim Reports (2003)
        */
        function init$16() {
          //no-op
          if (!this.sphere) {
            this.k0 = msfnz(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts));
          }
        }

        /* Cylindrical Equal Area forward equations--mapping lat,long to x,y
            ------------------------------------------------------------*/
        function forward$15(p) {
          var lon = p.x;
          var lat = p.y;
          var x, y;
          /* Forward equations
              -----------------*/
          var dlon = adjust_lon(lon - this.long0);
          if (this.sphere) {
            x = this.x0 + this.a * dlon * Math.cos(this.lat_ts);
            y = this.y0 + this.a * Math.sin(lat) / Math.cos(this.lat_ts);
          } else {
            var qs = qsfnz(this.e, Math.sin(lat));
            x = this.x0 + this.a * this.k0 * dlon;
            y = this.y0 + this.a * qs * 0.5 / this.k0;
          }

          p.x = x;
          p.y = y;
          return p;
        }

        /* Cylindrical Equal Area inverse equations--mapping x,y to lat/long
            ------------------------------------------------------------*/
        function inverse$15(p) {
          p.x -= this.x0;
          p.y -= this.y0;
          var lon, lat;

          if (this.sphere) {
            lon = adjust_lon(this.long0 + (p.x / this.a) / Math.cos(this.lat_ts));
            lat = Math.asin((p.y / this.a) * Math.cos(this.lat_ts));
          } else {
            lat = iqsfnz(this.e, 2 * p.y * this.k0 / this.a);
            lon = adjust_lon(this.long0 + p.x / (this.a * this.k0));
          }

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$17 = ["cea"];
        var cea = {
          init: init$16,
          forward: forward$15,
          inverse: inverse$15,
          names: names$17
        };

        function init$17() {

          this.x0 = this.x0 || 0;
          this.y0 = this.y0 || 0;
          this.lat0 = this.lat0 || 0;
          this.long0 = this.long0 || 0;
          this.lat_ts = this.lat_ts || 0;
          this.title = this.title || "Equidistant Cylindrical (Plate Carre)";

          this.rc = Math.cos(this.lat_ts);
        }

        // forward equations--mapping lat,long to x,y
        // -----------------------------------------------------------------
        function forward$16(p) {

          var lon = p.x;
          var lat = p.y;

          var dlon = adjust_lon(lon - this.long0);
          var dlat = adjust_lat(lat - this.lat0);
          p.x = this.x0 + (this.a * dlon * this.rc);
          p.y = this.y0 + (this.a * dlat);
          return p;
        }

        // inverse equations--mapping x,y to lat/long
        // -----------------------------------------------------------------
        function inverse$16(p) {

          var x = p.x;
          var y = p.y;

          p.x = adjust_lon(this.long0 + ((x - this.x0) / (this.a * this.rc)));
          p.y = adjust_lat(this.lat0 + ((y - this.y0) / (this.a)));
          return p;
        }

        var names$18 = ["Equirectangular", "Equidistant_Cylindrical", "eqc"];
        var eqc = {
          init: init$17,
          forward: forward$16,
          inverse: inverse$16,
          names: names$18
        };

        var MAX_ITER$2 = 20;

        function init$18() {
          /* Place parameters in static storage for common use
              -------------------------------------------------*/
          this.temp = this.b / this.a;
          this.es = 1 - Math.pow(this.temp, 2); // devait etre dans tmerc.js mais n y est pas donc je commente sinon retour de valeurs nulles
          this.e = Math.sqrt(this.es);
          this.e0 = e0fn(this.es);
          this.e1 = e1fn(this.es);
          this.e2 = e2fn(this.es);
          this.e3 = e3fn(this.es);
          this.ml0 = this.a * mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0); //si que des zeros le calcul ne se fait pas
        }

        /* Polyconic forward equations--mapping lat,long to x,y
            ---------------------------------------------------*/
        function forward$17(p) {
          var lon = p.x;
          var lat = p.y;
          var x, y, el;
          var dlon = adjust_lon(lon - this.long0);
          el = dlon * Math.sin(lat);
          if (this.sphere) {
            if (Math.abs(lat) <= EPSLN) {
              x = this.a * dlon;
              y = -1 * this.a * this.lat0;
            } else {
              x = this.a * Math.sin(el) / Math.tan(lat);
              y = this.a * (adjust_lat(lat - this.lat0) + (1 - Math.cos(el)) / Math.tan(lat));
            }
          } else {
            if (Math.abs(lat) <= EPSLN) {
              x = this.a * dlon;
              y = -1 * this.ml0;
            } else {
              var nl = gN(this.a, this.e, Math.sin(lat)) / Math.tan(lat);
              x = nl * Math.sin(el);
              y = this.a * mlfn(this.e0, this.e1, this.e2, this.e3, lat) - this.ml0 + nl * (1 - Math.cos(el));
            }

          }
          p.x = x + this.x0;
          p.y = y + this.y0;
          return p;
        }

        /* Inverse equations
          -----------------*/
        function inverse$17(p) {
          var lon, lat, x, y, i;
          var al, bl;
          var phi, dphi;
          x = p.x - this.x0;
          y = p.y - this.y0;

          if (this.sphere) {
            if (Math.abs(y + this.a * this.lat0) <= EPSLN) {
              lon = adjust_lon(x / this.a + this.long0);
              lat = 0;
            } else {
              al = this.lat0 + y / this.a;
              bl = x * x / this.a / this.a + al * al;
              phi = al;
              var tanphi;
              for (i = MAX_ITER$2; i; --i) {
                tanphi = Math.tan(phi);
                dphi = -1 * (al * (phi * tanphi + 1) - phi - 0.5 * (phi * phi + bl) * tanphi) / ((phi - al) / tanphi - 1);
                phi += dphi;
                if (Math.abs(dphi) <= EPSLN) {
                  lat = phi;
                  break;
                }
              }
              lon = adjust_lon(this.long0 + (Math.asin(x * Math.tan(phi) / this.a)) / Math.sin(lat));
            }
          } else {
            if (Math.abs(y + this.ml0) <= EPSLN) {
              lat = 0;
              lon = adjust_lon(this.long0 + x / this.a);
            } else {

              al = (this.ml0 + y) / this.a;
              bl = x * x / this.a / this.a + al * al;
              phi = al;
              var cl, mln, mlnp, ma;
              var con;
              for (i = MAX_ITER$2; i; --i) {
                con = this.e * Math.sin(phi);
                cl = Math.sqrt(1 - con * con) * Math.tan(phi);
                mln = this.a * mlfn(this.e0, this.e1, this.e2, this.e3, phi);
                mlnp = this.e0 - 2 * this.e1 * Math.cos(2 * phi) + 4 * this.e2 * Math.cos(4 * phi) - 6 * this.e3 * Math.cos(6 * phi);
                ma = mln / this.a;
                dphi = (al * (cl * ma + 1) - ma - 0.5 * cl * (ma * ma + bl)) / (this.es * Math.sin(2 * phi) * (ma * ma + bl - 2 * al * ma) / (4 * cl) + (al - ma) * (cl * mlnp - 2 / Math.sin(2 * phi)) - mlnp);
                phi -= dphi;
                if (Math.abs(dphi) <= EPSLN) {
                  lat = phi;
                  break;
                }
              }

              //lat=phi4z(this.e,this.e0,this.e1,this.e2,this.e3,al,bl,0,0);
              cl = Math.sqrt(1 - this.es * Math.pow(Math.sin(lat), 2)) * Math.tan(lat);
              lon = adjust_lon(this.long0 + Math.asin(x * cl / this.a) / Math.sin(lat));
            }
          }

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$19 = ["Polyconic", "poly"];
        var poly = {
          init: init$18,
          forward: forward$17,
          inverse: inverse$17,
          names: names$19
        };

        /*
          reference
            Department of Land and Survey Technical Circular 1973/32
              http://www.linz.govt.nz/docs/miscellaneous/nz-map-definition.pdf
            OSG Technical Report 4.1
              http://www.linz.govt.nz/docs/miscellaneous/nzmg.pdf
          */

        /**
         * iterations: Number of iterations to refine inverse transform.
         *     0 -> km accuracy
         *     1 -> m accuracy -- suitable for most mapping applications
         *     2 -> mm accuracy
         */


        function init$19() {
          this.A = [];
          this.A[1] = 0.6399175073;
          this.A[2] = -0.1358797613;
          this.A[3] = 0.063294409;
          this.A[4] = -0.02526853;
          this.A[5] = 0.0117879;
          this.A[6] = -0.0055161;
          this.A[7] = 0.0026906;
          this.A[8] = -0.001333;
          this.A[9] = 0.00067;
          this.A[10] = -0.00034;

          this.B_re = [];
          this.B_im = [];
          this.B_re[1] = 0.7557853228;
          this.B_im[1] = 0;
          this.B_re[2] = 0.249204646;
          this.B_im[2] = 0.003371507;
          this.B_re[3] = -0.001541739;
          this.B_im[3] = 0.041058560;
          this.B_re[4] = -0.10162907;
          this.B_im[4] = 0.01727609;
          this.B_re[5] = -0.26623489;
          this.B_im[5] = -0.36249218;
          this.B_re[6] = -0.6870983;
          this.B_im[6] = -1.1651967;

          this.C_re = [];
          this.C_im = [];
          this.C_re[1] = 1.3231270439;
          this.C_im[1] = 0;
          this.C_re[2] = -0.577245789;
          this.C_im[2] = -0.007809598;
          this.C_re[3] = 0.508307513;
          this.C_im[3] = -0.112208952;
          this.C_re[4] = -0.15094762;
          this.C_im[4] = 0.18200602;
          this.C_re[5] = 1.01418179;
          this.C_im[5] = 1.64497696;
          this.C_re[6] = 1.9660549;
          this.C_im[6] = 2.5127645;

          this.D = [];
          this.D[1] = 1.5627014243;
          this.D[2] = 0.5185406398;
          this.D[3] = -0.03333098;
          this.D[4] = -0.1052906;
          this.D[5] = -0.0368594;
          this.D[6] = 0.007317;
          this.D[7] = 0.01220;
          this.D[8] = 0.00394;
          this.D[9] = -0.0013;
        }

        /**
            New Zealand Map Grid Forward  - long/lat to x/y
            long/lat in radians
          */
        function forward$18(p) {
          var n;
          var lon = p.x;
          var lat = p.y;

          var delta_lat = lat - this.lat0;
          var delta_lon = lon - this.long0;

          // 1. Calculate d_phi and d_psi    ...                          // and d_lambda
          // For this algorithm, delta_latitude is in seconds of arc x 10-5, so we need to scale to those units. Longitude is radians.
          var d_phi = delta_lat / SEC_TO_RAD * 1E-5;
          var d_lambda = delta_lon;
          var d_phi_n = 1; // d_phi^0

          var d_psi = 0;
          for (n = 1; n <= 10; n++) {
            d_phi_n = d_phi_n * d_phi;
            d_psi = d_psi + this.A[n] * d_phi_n;
          }

          // 2. Calculate theta
          var th_re = d_psi;
          var th_im = d_lambda;

          // 3. Calculate z
          var th_n_re = 1;
          var th_n_im = 0; // theta^0
          var th_n_re1;
          var th_n_im1;

          var z_re = 0;
          var z_im = 0;
          for (n = 1; n <= 6; n++) {
            th_n_re1 = th_n_re * th_re - th_n_im * th_im;
            th_n_im1 = th_n_im * th_re + th_n_re * th_im;
            th_n_re = th_n_re1;
            th_n_im = th_n_im1;
            z_re = z_re + this.B_re[n] * th_n_re - this.B_im[n] * th_n_im;
            z_im = z_im + this.B_im[n] * th_n_re + this.B_re[n] * th_n_im;
          }

          // 4. Calculate easting and northing
          p.x = (z_im * this.a) + this.x0;
          p.y = (z_re * this.a) + this.y0;

          return p;
        }

        /**
            New Zealand Map Grid Inverse  -  x/y to long/lat
          */
        function inverse$18(p) {
          var n;
          var x = p.x;
          var y = p.y;

          var delta_x = x - this.x0;
          var delta_y = y - this.y0;

          // 1. Calculate z
          var z_re = delta_y / this.a;
          var z_im = delta_x / this.a;

          // 2a. Calculate theta - first approximation gives km accuracy
          var z_n_re = 1;
          var z_n_im = 0; // z^0
          var z_n_re1;
          var z_n_im1;

          var th_re = 0;
          var th_im = 0;
          for (n = 1; n <= 6; n++) {
            z_n_re1 = z_n_re * z_re - z_n_im * z_im;
            z_n_im1 = z_n_im * z_re + z_n_re * z_im;
            z_n_re = z_n_re1;
            z_n_im = z_n_im1;
            th_re = th_re + this.C_re[n] * z_n_re - this.C_im[n] * z_n_im;
            th_im = th_im + this.C_im[n] * z_n_re + this.C_re[n] * z_n_im;
          }

          // 2b. Iterate to refine the accuracy of the calculation
          //        0 iterations gives km accuracy
          //        1 iteration gives m accuracy -- good enough for most mapping applications
          //        2 iterations bives mm accuracy
          for (var i = 0; i < this.iterations; i++) {
            var th_n_re = th_re;
            var th_n_im = th_im;
            var th_n_re1;
            var th_n_im1;

            var num_re = z_re;
            var num_im = z_im;
            for (n = 2; n <= 6; n++) {
              th_n_re1 = th_n_re * th_re - th_n_im * th_im;
              th_n_im1 = th_n_im * th_re + th_n_re * th_im;
              th_n_re = th_n_re1;
              th_n_im = th_n_im1;
              num_re = num_re + (n - 1) * (this.B_re[n] * th_n_re - this.B_im[n] * th_n_im);
              num_im = num_im + (n - 1) * (this.B_im[n] * th_n_re + this.B_re[n] * th_n_im);
            }

            th_n_re = 1;
            th_n_im = 0;
            var den_re = this.B_re[1];
            var den_im = this.B_im[1];
            for (n = 2; n <= 6; n++) {
              th_n_re1 = th_n_re * th_re - th_n_im * th_im;
              th_n_im1 = th_n_im * th_re + th_n_re * th_im;
              th_n_re = th_n_re1;
              th_n_im = th_n_im1;
              den_re = den_re + n * (this.B_re[n] * th_n_re - this.B_im[n] * th_n_im);
              den_im = den_im + n * (this.B_im[n] * th_n_re + this.B_re[n] * th_n_im);
            }

            // Complex division
            var den2 = den_re * den_re + den_im * den_im;
            th_re = (num_re * den_re + num_im * den_im) / den2;
            th_im = (num_im * den_re - num_re * den_im) / den2;
          }

          // 3. Calculate d_phi              ...                                    // and d_lambda
          var d_psi = th_re;
          var d_lambda = th_im;
          var d_psi_n = 1; // d_psi^0

          var d_phi = 0;
          for (n = 1; n <= 9; n++) {
            d_psi_n = d_psi_n * d_psi;
            d_phi = d_phi + this.D[n] * d_psi_n;
          }

          // 4. Calculate latitude and longitude
          // d_phi is calcuated in second of arc * 10^-5, so we need to scale back to radians. d_lambda is in radians.
          var lat = this.lat0 + (d_phi * SEC_TO_RAD * 1E5);
          var lon = this.long0 + d_lambda;

          p.x = lon;
          p.y = lat;

          return p;
        }

        var names$20 = ["New_Zealand_Map_Grid", "nzmg"];
        var nzmg = {
          init: init$19,
          forward: forward$18,
          inverse: inverse$18,
          names: names$20
        };

        /*
          reference
            "New Equal-Area Map Projections for Noncircular Regions", John P. Snyder,
            The American Cartographer, Vol 15, No. 4, October 1988, pp. 341-355.
          */


        /* Initialize the Miller Cylindrical projection
          -------------------------------------------*/
        function init$20() {
          //no-op
        }

        /* Miller Cylindrical forward equations--mapping lat,long to x,y
            ------------------------------------------------------------*/
        function forward$19(p) {
          var lon = p.x;
          var lat = p.y;
          /* Forward equations
              -----------------*/
          var dlon = adjust_lon(lon - this.long0);
          var x = this.x0 + this.a * dlon;
          var y = this.y0 + this.a * Math.log(Math.tan((Math.PI / 4) + (lat / 2.5))) * 1.25;

          p.x = x;
          p.y = y;
          return p;
        }

        /* Miller Cylindrical inverse equations--mapping x,y to lat/long
            ------------------------------------------------------------*/
        function inverse$19(p) {
          p.x -= this.x0;
          p.y -= this.y0;

          var lon = adjust_lon(this.long0 + p.x / this.a);
          var lat = 2.5 * (Math.atan(Math.exp(0.8 * p.y / this.a)) - Math.PI / 4);

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$21 = ["Miller_Cylindrical", "mill"];
        var mill = {
          init: init$20,
          forward: forward$19,
          inverse: inverse$19,
          names: names$21
        };

        var MAX_ITER$3 = 20;

        function init$21() {
          /* Place parameters in static storage for common use
            -------------------------------------------------*/


          if (!this.sphere) {
            this.en = pj_enfn(this.es);
          } else {
            this.n = 1;
            this.m = 0;
            this.es = 0;
            this.C_y = Math.sqrt((this.m + 1) / this.n);
            this.C_x = this.C_y / (this.m + 1);
          }

        }

        /* Sinusoidal forward equations--mapping lat,long to x,y
          -----------------------------------------------------*/
        function forward$20(p) {
          var x, y;
          var lon = p.x;
          var lat = p.y;
          /* Forward equations
            -----------------*/
          lon = adjust_lon(lon - this.long0);

          if (this.sphere) {
            if (!this.m) {
              lat = this.n !== 1 ? Math.asin(this.n * Math.sin(lat)) : lat;
            } else {
              var k = this.n * Math.sin(lat);
              for (var i = MAX_ITER$3; i; --i) {
                var V = (this.m * lat + Math.sin(lat) - k) / (this.m + Math.cos(lat));
                lat -= V;
                if (Math.abs(V) < EPSLN) {
                  break;
                }
              }
            }
            x = this.a * this.C_x * lon * (this.m + Math.cos(lat));
            y = this.a * this.C_y * lat;

          } else {

            var s = Math.sin(lat);
            var c = Math.cos(lat);
            y = this.a * pj_mlfn(lat, s, c, this.en);
            x = this.a * lon * c / Math.sqrt(1 - this.es * s * s);
          }

          p.x = x;
          p.y = y;
          return p;
        }

        function inverse$20(p) {
          var lat, temp, lon, s;

          p.x -= this.x0;
          lon = p.x / this.a;
          p.y -= this.y0;
          lat = p.y / this.a;

          if (this.sphere) {
            lat /= this.C_y;
            lon = lon / (this.C_x * (this.m + Math.cos(lat)));
            if (this.m) {
              lat = asinz((this.m * lat + Math.sin(lat)) / this.n);
            } else if (this.n !== 1) {
              lat = asinz(Math.sin(lat) / this.n);
            }
            lon = adjust_lon(lon + this.long0);
            lat = adjust_lat(lat);
          } else {
            lat = pj_inv_mlfn(p.y / this.a, this.es, this.en);
            s = Math.abs(lat);
            if (s < HALF_PI) {
              s = Math.sin(lat);
              temp = this.long0 + p.x * Math.sqrt(1 - this.es * s * s) / (this.a * Math.cos(lat));
              //temp = this.long0 + p.x / (this.a * Math.cos(lat));
              lon = adjust_lon(temp);
            } else if ((s - EPSLN) < HALF_PI) {
              lon = this.long0;
            }
          }
          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$22 = ["Sinusoidal", "sinu"];
        var sinu = {
          init: init$21,
          forward: forward$20,
          inverse: inverse$20,
          names: names$22
        };

        function init$22() {}
        /* Mollweide forward equations--mapping lat,long to x,y
            ----------------------------------------------------*/
        function forward$21(p) {

          /* Forward equations
              -----------------*/
          var lon = p.x;
          var lat = p.y;

          var delta_lon = adjust_lon(lon - this.long0);
          var theta = lat;
          var con = Math.PI * Math.sin(lat);

          /* Iterate using the Newton-Raphson method to find theta
              -----------------------------------------------------*/
          while (true) {
            var delta_theta = -(theta + Math.sin(theta) - con) / (1 + Math.cos(theta));
            theta += delta_theta;
            if (Math.abs(delta_theta) < EPSLN) {
              break;
            }
          }
          theta /= 2;

          /* If the latitude is 90 deg, force the x coordinate to be "0 + false easting"
               this is done here because of precision problems with "cos(theta)"
               --------------------------------------------------------------------------*/
          if (Math.PI / 2 - Math.abs(lat) < EPSLN) {
            delta_lon = 0;
          }
          var x = 0.900316316158 * this.a * delta_lon * Math.cos(theta) + this.x0;
          var y = 1.4142135623731 * this.a * Math.sin(theta) + this.y0;

          p.x = x;
          p.y = y;
          return p;
        }

        function inverse$21(p) {
          var theta;
          var arg;

          /* Inverse equations
              -----------------*/
          p.x -= this.x0;
          p.y -= this.y0;
          arg = p.y / (1.4142135623731 * this.a);

          /* Because of division by zero problems, 'arg' can not be 1.  Therefore
               a number very close to one is used instead.
               -------------------------------------------------------------------*/
          if (Math.abs(arg) > 0.999999999999) {
            arg = 0.999999999999;
          }
          theta = Math.asin(arg);
          var lon = adjust_lon(this.long0 + (p.x / (0.900316316158 * this.a * Math.cos(theta))));
          if (lon < (-Math.PI)) {
            lon = -Math.PI;
          }
          if (lon > Math.PI) {
            lon = Math.PI;
          }
          arg = (2 * theta + Math.sin(2 * theta)) / Math.PI;
          if (Math.abs(arg) > 1) {
            arg = 1;
          }
          var lat = Math.asin(arg);

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$23 = ["Mollweide", "moll"];
        var moll = {
          init: init$22,
          forward: forward$21,
          inverse: inverse$21,
          names: names$23
        };

        function init$23() {

          /* Place parameters in static storage for common use
              -------------------------------------------------*/
          // Standard Parallels cannot be equal and on opposite sides of the equator
          if (Math.abs(this.lat1 + this.lat2) < EPSLN) {
            return;
          }
          this.lat2 = this.lat2 || this.lat1;
          this.temp = this.b / this.a;
          this.es = 1 - Math.pow(this.temp, 2);
          this.e = Math.sqrt(this.es);
          this.e0 = e0fn(this.es);
          this.e1 = e1fn(this.es);
          this.e2 = e2fn(this.es);
          this.e3 = e3fn(this.es);

          this.sinphi = Math.sin(this.lat1);
          this.cosphi = Math.cos(this.lat1);

          this.ms1 = msfnz(this.e, this.sinphi, this.cosphi);
          this.ml1 = mlfn(this.e0, this.e1, this.e2, this.e3, this.lat1);

          if (Math.abs(this.lat1 - this.lat2) < EPSLN) {
            this.ns = this.sinphi;
          } else {
            this.sinphi = Math.sin(this.lat2);
            this.cosphi = Math.cos(this.lat2);
            this.ms2 = msfnz(this.e, this.sinphi, this.cosphi);
            this.ml2 = mlfn(this.e0, this.e1, this.e2, this.e3, this.lat2);
            this.ns = (this.ms1 - this.ms2) / (this.ml2 - this.ml1);
          }
          this.g = this.ml1 + this.ms1 / this.ns;
          this.ml0 = mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
          this.rh = this.a * (this.g - this.ml0);
        }

        /* Equidistant Conic forward equations--mapping lat,long to x,y
          -----------------------------------------------------------*/
        function forward$22(p) {
          var lon = p.x;
          var lat = p.y;
          var rh1;

          /* Forward equations
              -----------------*/
          if (this.sphere) {
            rh1 = this.a * (this.g - lat);
          } else {
            var ml = mlfn(this.e0, this.e1, this.e2, this.e3, lat);
            rh1 = this.a * (this.g - ml);
          }
          var theta = this.ns * adjust_lon(lon - this.long0);
          var x = this.x0 + rh1 * Math.sin(theta);
          var y = this.y0 + this.rh - rh1 * Math.cos(theta);
          p.x = x;
          p.y = y;
          return p;
        }

        /* Inverse equations
          -----------------*/
        function inverse$22(p) {
          p.x -= this.x0;
          p.y = this.rh - p.y + this.y0;
          var con, rh1, lat, lon;
          if (this.ns >= 0) {
            rh1 = Math.sqrt(p.x * p.x + p.y * p.y);
            con = 1;
          } else {
            rh1 = -Math.sqrt(p.x * p.x + p.y * p.y);
            con = -1;
          }
          var theta = 0;
          if (rh1 !== 0) {
            theta = Math.atan2(con * p.x, con * p.y);
          }

          if (this.sphere) {
            lon = adjust_lon(this.long0 + theta / this.ns);
            lat = adjust_lat(this.g - rh1 / this.a);
            p.x = lon;
            p.y = lat;
            return p;
          } else {
            var ml = this.g - rh1 / this.a;
            lat = imlfn(ml, this.e0, this.e1, this.e2, this.e3);
            lon = adjust_lon(this.long0 + theta / this.ns);
            p.x = lon;
            p.y = lat;
            return p;
          }

        }

        var names$24 = ["Equidistant_Conic", "eqdc"];
        var eqdc = {
          init: init$23,
          forward: forward$22,
          inverse: inverse$22,
          names: names$24
        };

        /* Initialize the Van Der Grinten projection
          ----------------------------------------*/
        function init$24() {
          //this.R = 6370997; //Radius of earth
          this.R = this.a;
        }

        function forward$23(p) {

          var lon = p.x;
          var lat = p.y;

          /* Forward equations
            -----------------*/
          var dlon = adjust_lon(lon - this.long0);
          var x, y;

          if (Math.abs(lat) <= EPSLN) {
            x = this.x0 + this.R * dlon;
            y = this.y0;
          }
          var theta = asinz(2 * Math.abs(lat / Math.PI));
          if ((Math.abs(dlon) <= EPSLN) || (Math.abs(Math.abs(lat) - HALF_PI) <= EPSLN)) {
            x = this.x0;
            if (lat >= 0) {
              y = this.y0 + Math.PI * this.R * Math.tan(0.5 * theta);
            } else {
              y = this.y0 + Math.PI * this.R * -Math.tan(0.5 * theta);
            }
            //  return(OK);
          }
          var al = 0.5 * Math.abs((Math.PI / dlon) - (dlon / Math.PI));
          var asq = al * al;
          var sinth = Math.sin(theta);
          var costh = Math.cos(theta);

          var g = costh / (sinth + costh - 1);
          var gsq = g * g;
          var m = g * (2 / sinth - 1);
          var msq = m * m;
          var con = Math.PI * this.R * (al * (g - msq) + Math.sqrt(asq * (g - msq) * (g - msq) - (msq + asq) * (gsq - msq))) / (msq + asq);
          if (dlon < 0) {
            con = -con;
          }
          x = this.x0 + con;
          //con = Math.abs(con / (Math.PI * this.R));
          var q = asq + g;
          con = Math.PI * this.R * (m * q - al * Math.sqrt((msq + asq) * (asq + 1) - q * q)) / (msq + asq);
          if (lat >= 0) {
            //y = this.y0 + Math.PI * this.R * Math.sqrt(1 - con * con - 2 * al * con);
            y = this.y0 + con;
          } else {
            //y = this.y0 - Math.PI * this.R * Math.sqrt(1 - con * con - 2 * al * con);
            y = this.y0 - con;
          }
          p.x = x;
          p.y = y;
          return p;
        }

        /* Van Der Grinten inverse equations--mapping x,y to lat/long
          ---------------------------------------------------------*/
        function inverse$23(p) {
          var lon, lat;
          var xx, yy, xys, c1, c2, c3;
          var a1;
          var m1;
          var con;
          var th1;
          var d;

          /* inverse equations
            -----------------*/
          p.x -= this.x0;
          p.y -= this.y0;
          con = Math.PI * this.R;
          xx = p.x / con;
          yy = p.y / con;
          xys = xx * xx + yy * yy;
          c1 = -Math.abs(yy) * (1 + xys);
          c2 = c1 - 2 * yy * yy + xx * xx;
          c3 = -2 * c1 + 1 + 2 * yy * yy + xys * xys;
          d = yy * yy / c3 + (2 * c2 * c2 * c2 / c3 / c3 / c3 - 9 * c1 * c2 / c3 / c3) / 27;
          a1 = (c1 - c2 * c2 / 3 / c3) / c3;
          m1 = 2 * Math.sqrt(-a1 / 3);
          con = ((3 * d) / a1) / m1;
          if (Math.abs(con) > 1) {
            if (con >= 0) {
              con = 1;
            } else {
              con = -1;
            }
          }
          th1 = Math.acos(con) / 3;
          if (p.y >= 0) {
            lat = (-m1 * Math.cos(th1 + Math.PI / 3) - c2 / 3 / c3) * Math.PI;
          } else {
            lat = -(-m1 * Math.cos(th1 + Math.PI / 3) - c2 / 3 / c3) * Math.PI;
          }

          if (Math.abs(xx) < EPSLN) {
            lon = this.long0;
          } else {
            lon = adjust_lon(this.long0 + Math.PI * (xys - 1 + Math.sqrt(1 + 2 * (xx * xx - yy * yy) + xys * xys)) / 2 / xx);
          }

          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$25 = ["Van_der_Grinten_I", "VanDerGrinten", "vandg"];
        var vandg = {
          init: init$24,
          forward: forward$23,
          inverse: inverse$23,
          names: names$25
        };

        function init$25() {
          this.sin_p12 = Math.sin(this.lat0);
          this.cos_p12 = Math.cos(this.lat0);
        }

        function forward$24(p) {
          var lon = p.x;
          var lat = p.y;
          var sinphi = Math.sin(p.y);
          var cosphi = Math.cos(p.y);
          var dlon = adjust_lon(lon - this.long0);
          var e0, e1, e2, e3, Mlp, Ml, tanphi, Nl1, Nl, psi, Az, G, H, GH, Hs, c, kp, cos_c, s, s2, s3, s4, s5;
          if (this.sphere) {
            if (Math.abs(this.sin_p12 - 1) <= EPSLN) {
              //North Pole case
              p.x = this.x0 + this.a * (HALF_PI - lat) * Math.sin(dlon);
              p.y = this.y0 - this.a * (HALF_PI - lat) * Math.cos(dlon);
              return p;
            } else if (Math.abs(this.sin_p12 + 1) <= EPSLN) {
              //South Pole case
              p.x = this.x0 + this.a * (HALF_PI + lat) * Math.sin(dlon);
              p.y = this.y0 + this.a * (HALF_PI + lat) * Math.cos(dlon);
              return p;
            } else {
              //default case
              cos_c = this.sin_p12 * sinphi + this.cos_p12 * cosphi * Math.cos(dlon);
              c = Math.acos(cos_c);
              kp = c / Math.sin(c);
              p.x = this.x0 + this.a * kp * cosphi * Math.sin(dlon);
              p.y = this.y0 + this.a * kp * (this.cos_p12 * sinphi - this.sin_p12 * cosphi * Math.cos(dlon));
              return p;
            }
          } else {
            e0 = e0fn(this.es);
            e1 = e1fn(this.es);
            e2 = e2fn(this.es);
            e3 = e3fn(this.es);
            if (Math.abs(this.sin_p12 - 1) <= EPSLN) {
              //North Pole case
              Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
              Ml = this.a * mlfn(e0, e1, e2, e3, lat);
              p.x = this.x0 + (Mlp - Ml) * Math.sin(dlon);
              p.y = this.y0 - (Mlp - Ml) * Math.cos(dlon);
              return p;
            } else if (Math.abs(this.sin_p12 + 1) <= EPSLN) {
              //South Pole case
              Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
              Ml = this.a * mlfn(e0, e1, e2, e3, lat);
              p.x = this.x0 + (Mlp + Ml) * Math.sin(dlon);
              p.y = this.y0 + (Mlp + Ml) * Math.cos(dlon);
              return p;
            } else {
              //Default case
              tanphi = sinphi / cosphi;
              Nl1 = gN(this.a, this.e, this.sin_p12);
              Nl = gN(this.a, this.e, sinphi);
              psi = Math.atan((1 - this.es) * tanphi + this.es * Nl1 * this.sin_p12 / (Nl * cosphi));
              Az = Math.atan2(Math.sin(dlon), this.cos_p12 * Math.tan(psi) - this.sin_p12 * Math.cos(dlon));
              if (Az === 0) {
                s = Math.asin(this.cos_p12 * Math.sin(psi) - this.sin_p12 * Math.cos(psi));
              } else if (Math.abs(Math.abs(Az) - Math.PI) <= EPSLN) {
                s = -Math.asin(this.cos_p12 * Math.sin(psi) - this.sin_p12 * Math.cos(psi));
              } else {
                s = Math.asin(Math.sin(dlon) * Math.cos(psi) / Math.sin(Az));
              }
              G = this.e * this.sin_p12 / Math.sqrt(1 - this.es);
              H = this.e * this.cos_p12 * Math.cos(Az) / Math.sqrt(1 - this.es);
              GH = G * H;
              Hs = H * H;
              s2 = s * s;
              s3 = s2 * s;
              s4 = s3 * s;
              s5 = s4 * s;
              c = Nl1 * s * (1 - s2 * Hs * (1 - Hs) / 6 + s3 / 8 * GH * (1 - 2 * Hs) + s4 / 120 * (Hs * (4 - 7 * Hs) - 3 * G * G * (1 - 7 * Hs)) - s5 / 48 * GH);
              p.x = this.x0 + c * Math.sin(Az);
              p.y = this.y0 + c * Math.cos(Az);
              return p;
            }
          }


        }

        function inverse$24(p) {
          p.x -= this.x0;
          p.y -= this.y0;
          var rh, z, sinz, cosz, lon, lat, con, e0, e1, e2, e3, Mlp, M, N1, psi, Az, cosAz, tmp, A, B, D, Ee, F;
          if (this.sphere) {
            rh = Math.sqrt(p.x * p.x + p.y * p.y);
            if (rh > (2 * HALF_PI * this.a)) {
              return;
            }
            z = rh / this.a;

            sinz = Math.sin(z);
            cosz = Math.cos(z);

            lon = this.long0;
            if (Math.abs(rh) <= EPSLN) {
              lat = this.lat0;
            } else {
              lat = asinz(cosz * this.sin_p12 + (p.y * sinz * this.cos_p12) / rh);
              con = Math.abs(this.lat0) - HALF_PI;
              if (Math.abs(con) <= EPSLN) {
                if (this.lat0 >= 0) {
                  lon = adjust_lon(this.long0 + Math.atan2(p.x, -p.y));
                } else {
                  lon = adjust_lon(this.long0 - Math.atan2(-p.x, p.y));
                }
              } else {
                /*con = cosz - this.sin_p12 * Math.sin(lat);
                if ((Math.abs(con) < EPSLN) && (Math.abs(p.x) < EPSLN)) {
                  //no-op, just keep the lon value as is
                } else {
                  var temp = Math.atan2((p.x * sinz * this.cos_p12), (con * rh));
                  lon = adjust_lon(this.long0 + Math.atan2((p.x * sinz * this.cos_p12), (con * rh)));
                }*/
                lon = adjust_lon(this.long0 + Math.atan2(p.x * sinz, rh * this.cos_p12 * cosz - p.y * this.sin_p12 * sinz));
              }
            }

            p.x = lon;
            p.y = lat;
            return p;
          } else {
            e0 = e0fn(this.es);
            e1 = e1fn(this.es);
            e2 = e2fn(this.es);
            e3 = e3fn(this.es);
            if (Math.abs(this.sin_p12 - 1) <= EPSLN) {
              //North pole case
              Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
              rh = Math.sqrt(p.x * p.x + p.y * p.y);
              M = Mlp - rh;
              lat = imlfn(M / this.a, e0, e1, e2, e3);
              lon = adjust_lon(this.long0 + Math.atan2(p.x, -1 * p.y));
              p.x = lon;
              p.y = lat;
              return p;
            } else if (Math.abs(this.sin_p12 + 1) <= EPSLN) {
              //South pole case
              Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
              rh = Math.sqrt(p.x * p.x + p.y * p.y);
              M = rh - Mlp;

              lat = imlfn(M / this.a, e0, e1, e2, e3);
              lon = adjust_lon(this.long0 + Math.atan2(p.x, p.y));
              p.x = lon;
              p.y = lat;
              return p;
            } else {
              //default case
              rh = Math.sqrt(p.x * p.x + p.y * p.y);
              Az = Math.atan2(p.x, p.y);
              N1 = gN(this.a, this.e, this.sin_p12);
              cosAz = Math.cos(Az);
              tmp = this.e * this.cos_p12 * cosAz;
              A = -tmp * tmp / (1 - this.es);
              B = 3 * this.es * (1 - A) * this.sin_p12 * this.cos_p12 * cosAz / (1 - this.es);
              D = rh / N1;
              Ee = D - A * (1 + A) * Math.pow(D, 3) / 6 - B * (1 + 3 * A) * Math.pow(D, 4) / 24;
              F = 1 - A * Ee * Ee / 2 - D * Ee * Ee * Ee / 6;
              psi = Math.asin(this.sin_p12 * Math.cos(Ee) + this.cos_p12 * Math.sin(Ee) * cosAz);
              lon = adjust_lon(this.long0 + Math.asin(Math.sin(Az) * Math.sin(Ee) / Math.cos(psi)));
              lat = Math.atan((1 - this.es * F * this.sin_p12 / Math.sin(psi)) * Math.tan(psi) / (1 - this.es));
              p.x = lon;
              p.y = lat;
              return p;
            }
          }

        }

        var names$26 = ["Azimuthal_Equidistant", "aeqd"];
        var aeqd = {
          init: init$25,
          forward: forward$24,
          inverse: inverse$24,
          names: names$26
        };

        function init$26() {
          //double temp;      /* temporary variable    */

          /* Place parameters in static storage for common use
              -------------------------------------------------*/
          this.sin_p14 = Math.sin(this.lat0);
          this.cos_p14 = Math.cos(this.lat0);
        }

        /* Orthographic forward equations--mapping lat,long to x,y
            ---------------------------------------------------*/
        function forward$25(p) {
          var sinphi, cosphi; /* sin and cos value        */
          var dlon; /* delta longitude value      */
          var coslon; /* cos of longitude        */
          var ksp; /* scale factor          */
          var g, x, y;
          var lon = p.x;
          var lat = p.y;
          /* Forward equations
              -----------------*/
          dlon = adjust_lon(lon - this.long0);

          sinphi = Math.sin(lat);
          cosphi = Math.cos(lat);

          coslon = Math.cos(dlon);
          g = this.sin_p14 * sinphi + this.cos_p14 * cosphi * coslon;
          ksp = 1;
          if ((g > 0) || (Math.abs(g) <= EPSLN)) {
            x = this.a * ksp * cosphi * Math.sin(dlon);
            y = this.y0 + this.a * ksp * (this.cos_p14 * sinphi - this.sin_p14 * cosphi * coslon);
          }
          p.x = x;
          p.y = y;
          return p;
        }

        function inverse$25(p) {
          var rh; /* height above ellipsoid      */
          var z; /* angle          */
          var sinz, cosz; /* sin of z and cos of z      */
          var con;
          var lon, lat;
          /* Inverse equations
              -----------------*/
          p.x -= this.x0;
          p.y -= this.y0;
          rh = Math.sqrt(p.x * p.x + p.y * p.y);
          z = asinz(rh / this.a);

          sinz = Math.sin(z);
          cosz = Math.cos(z);

          lon = this.long0;
          if (Math.abs(rh) <= EPSLN) {
            lat = this.lat0;
            p.x = lon;
            p.y = lat;
            return p;
          }
          lat = asinz(cosz * this.sin_p14 + (p.y * sinz * this.cos_p14) / rh);
          con = Math.abs(this.lat0) - HALF_PI;
          if (Math.abs(con) <= EPSLN) {
            if (this.lat0 >= 0) {
              lon = adjust_lon(this.long0 + Math.atan2(p.x, -p.y));
            } else {
              lon = adjust_lon(this.long0 - Math.atan2(-p.x, p.y));
            }
            p.x = lon;
            p.y = lat;
            return p;
          }
          lon = adjust_lon(this.long0 + Math.atan2((p.x * sinz), rh * this.cos_p14 * cosz - p.y * this.sin_p14 * sinz));
          p.x = lon;
          p.y = lat;
          return p;
        }

        var names$27 = ["ortho"];
        var ortho = {
          init: init$26,
          forward: forward$25,
          inverse: inverse$25,
          names: names$27
        };

        // QSC projection rewritten from the original PROJ4
        // https://github.com/OSGeo/proj.4/blob/master/src/PJ_qsc.c

        /* constants */
        var FACE_ENUM = {
          FRONT: 1,
          RIGHT: 2,
          BACK: 3,
          LEFT: 4,
          TOP: 5,
          BOTTOM: 6
        };

        var AREA_ENUM = {
          AREA_0: 1,
          AREA_1: 2,
          AREA_2: 3,
          AREA_3: 4
        };

        function init$27() {

          this.x0 = this.x0 || 0;
          this.y0 = this.y0 || 0;
          this.lat0 = this.lat0 || 0;
          this.long0 = this.long0 || 0;
          this.lat_ts = this.lat_ts || 0;
          this.title = this.title || "Quadrilateralized Spherical Cube";

          /* Determine the cube face from the center of projection. */
          if (this.lat0 >= HALF_PI - FORTPI / 2.0) {
            this.face = FACE_ENUM.TOP;
          } else if (this.lat0 <= -(HALF_PI - FORTPI / 2.0)) {
            this.face = FACE_ENUM.BOTTOM;
          } else if (Math.abs(this.long0) <= FORTPI) {
            this.face = FACE_ENUM.FRONT;
          } else if (Math.abs(this.long0) <= HALF_PI + FORTPI) {
            this.face = this.long0 > 0.0 ? FACE_ENUM.RIGHT : FACE_ENUM.LEFT;
          } else {
            this.face = FACE_ENUM.BACK;
          }

          /* Fill in useful values for the ellipsoid <-> sphere shift
           * described in [LK12]. */
          if (this.es !== 0) {
            this.one_minus_f = 1 - (this.a - this.b) / this.a;
            this.one_minus_f_squared = this.one_minus_f * this.one_minus_f;
          }
        }

        // QSC forward equations--mapping lat,long to x,y
        // -----------------------------------------------------------------
        function forward$26(p) {
          var xy = {
            x: 0,
            y: 0
          };
          var lat, lon;
          var theta, phi;
          var t, mu;
          /* nu; */
          var area = {
            value: 0
          };

          // move lon according to projection's lon
          p.x -= this.long0;

          /* Convert the geodetic latitude to a geocentric latitude.
           * This corresponds to the shift from the ellipsoid to the sphere
           * described in [LK12]. */
          if (this.es !== 0) { //if (P->es != 0) {
            lat = Math.atan(this.one_minus_f_squared * Math.tan(p.y));
          } else {
            lat = p.y;
          }

          /* Convert the input lat, lon into theta, phi as used by QSC.
           * This depends on the cube face and the area on it.
           * For the top and bottom face, we can compute theta and phi
           * directly from phi, lam. For the other faces, we must use
           * unit sphere cartesian coordinates as an intermediate step. */
          lon = p.x; //lon = lp.lam;
          if (this.face === FACE_ENUM.TOP) {
            phi = HALF_PI - lat;
            if (lon >= FORTPI && lon <= HALF_PI + FORTPI) {
              area.value = AREA_ENUM.AREA_0;
              theta = lon - HALF_PI;
            } else if (lon > HALF_PI + FORTPI || lon <= -(HALF_PI + FORTPI)) {
              area.value = AREA_ENUM.AREA_1;
              theta = (lon > 0.0 ? lon - SPI : lon + SPI);
            } else if (lon > -(HALF_PI + FORTPI) && lon <= -FORTPI) {
              area.value = AREA_ENUM.AREA_2;
              theta = lon + HALF_PI;
            } else {
              area.value = AREA_ENUM.AREA_3;
              theta = lon;
            }
          } else if (this.face === FACE_ENUM.BOTTOM) {
            phi = HALF_PI + lat;
            if (lon >= FORTPI && lon <= HALF_PI + FORTPI) {
              area.value = AREA_ENUM.AREA_0;
              theta = -lon + HALF_PI;
            } else if (lon < FORTPI && lon >= -FORTPI) {
              area.value = AREA_ENUM.AREA_1;
              theta = -lon;
            } else if (lon < -FORTPI && lon >= -(HALF_PI + FORTPI)) {
              area.value = AREA_ENUM.AREA_2;
              theta = -lon - HALF_PI;
            } else {
              area.value = AREA_ENUM.AREA_3;
              theta = (lon > 0.0 ? -lon + SPI : -lon - SPI);
            }
          } else {
            var q, r, s;
            var sinlat, coslat;
            var sinlon, coslon;

            if (this.face === FACE_ENUM.RIGHT) {
              lon = qsc_shift_lon_origin(lon, +HALF_PI);
            } else if (this.face === FACE_ENUM.BACK) {
              lon = qsc_shift_lon_origin(lon, +SPI);
            } else if (this.face === FACE_ENUM.LEFT) {
              lon = qsc_shift_lon_origin(lon, -HALF_PI);
            }
            sinlat = Math.sin(lat);
            coslat = Math.cos(lat);
            sinlon = Math.sin(lon);
            coslon = Math.cos(lon);
            q = coslat * coslon;
            r = coslat * sinlon;
            s = sinlat;

            if (this.face === FACE_ENUM.FRONT) {
              phi = Math.acos(q);
              theta = qsc_fwd_equat_face_theta(phi, s, r, area);
            } else if (this.face === FACE_ENUM.RIGHT) {
              phi = Math.acos(r);
              theta = qsc_fwd_equat_face_theta(phi, s, -q, area);
            } else if (this.face === FACE_ENUM.BACK) {
              phi = Math.acos(-q);
              theta = qsc_fwd_equat_face_theta(phi, s, -r, area);
            } else if (this.face === FACE_ENUM.LEFT) {
              phi = Math.acos(-r);
              theta = qsc_fwd_equat_face_theta(phi, s, q, area);
            } else {
              /* Impossible */
              phi = theta = 0;
              area.value = AREA_ENUM.AREA_0;
            }
          }

          /* Compute mu and nu for the area of definition.
           * For mu, see Eq. (3-21) in [OL76], but note the typos:
           * compare with Eq. (3-14). For nu, see Eq. (3-38). */
          mu = Math.atan((12 / SPI) * (theta + Math.acos(Math.sin(theta) * Math.cos(FORTPI)) - HALF_PI));
          t = Math.sqrt((1 - Math.cos(phi)) / (Math.cos(mu) * Math.cos(mu)) / (1 - Math.cos(Math.atan(1 / Math.cos(theta)))));

          /* Apply the result to the real area. */
          if (area.value === AREA_ENUM.AREA_1) {
            mu += HALF_PI;
          } else if (area.value === AREA_ENUM.AREA_2) {
            mu += SPI;
          } else if (area.value === AREA_ENUM.AREA_3) {
            mu += 1.5 * SPI;
          }

          /* Now compute x, y from mu and nu */
          xy.x = t * Math.cos(mu);
          xy.y = t * Math.sin(mu);
          xy.x = xy.x * this.a + this.x0;
          xy.y = xy.y * this.a + this.y0;

          p.x = xy.x;
          p.y = xy.y;
          return p;
        }

        // QSC inverse equations--mapping x,y to lat/long
        // -----------------------------------------------------------------
        function inverse$26(p) {
          var lp = {
            lam: 0,
            phi: 0
          };
          var mu, nu, cosmu, tannu;
          var tantheta, theta, cosphi, phi;
          var t;
          var area = {
            value: 0
          };

          /* de-offset */
          p.x = (p.x - this.x0) / this.a;
          p.y = (p.y - this.y0) / this.a;

          /* Convert the input x, y to the mu and nu angles as used by QSC.
           * This depends on the area of the cube face. */
          nu = Math.atan(Math.sqrt(p.x * p.x + p.y * p.y));
          mu = Math.atan2(p.y, p.x);
          if (p.x >= 0.0 && p.x >= Math.abs(p.y)) {
            area.value = AREA_ENUM.AREA_0;
          } else if (p.y >= 0.0 && p.y >= Math.abs(p.x)) {
            area.value = AREA_ENUM.AREA_1;
            mu -= HALF_PI;
          } else if (p.x < 0.0 && -p.x >= Math.abs(p.y)) {
            area.value = AREA_ENUM.AREA_2;
            mu = (mu < 0.0 ? mu + SPI : mu - SPI);
          } else {
            area.value = AREA_ENUM.AREA_3;
            mu += HALF_PI;
          }

          /* Compute phi and theta for the area of definition.
           * The inverse projection is not described in the original paper, but some
           * good hints can be found here (as of 2011-12-14):
           * http://fits.gsfc.nasa.gov/fitsbits/saf.93/saf.9302
           * (search for "Message-Id: <9302181759.AA25477 at fits.cv.nrao.edu>") */
          t = (SPI / 12) * Math.tan(mu);
          tantheta = Math.sin(t) / (Math.cos(t) - (1 / Math.sqrt(2)));
          theta = Math.atan(tantheta);
          cosmu = Math.cos(mu);
          tannu = Math.tan(nu);
          cosphi = 1 - cosmu * cosmu * tannu * tannu * (1 - Math.cos(Math.atan(1 / Math.cos(theta))));
          if (cosphi < -1) {
            cosphi = -1;
          } else if (cosphi > +1) {
            cosphi = +1;
          }

          /* Apply the result to the real area on the cube face.
           * For the top and bottom face, we can compute phi and lam directly.
           * For the other faces, we must use unit sphere cartesian coordinates
           * as an intermediate step. */
          if (this.face === FACE_ENUM.TOP) {
            phi = Math.acos(cosphi);
            lp.phi = HALF_PI - phi;
            if (area.value === AREA_ENUM.AREA_0) {
              lp.lam = theta + HALF_PI;
            } else if (area.value === AREA_ENUM.AREA_1) {
              lp.lam = (theta < 0.0 ? theta + SPI : theta - SPI);
            } else if (area.value === AREA_ENUM.AREA_2) {
              lp.lam = theta - HALF_PI;
            } else /* area.value == AREA_ENUM.AREA_3 */ {
              lp.lam = theta;
            }
          } else if (this.face === FACE_ENUM.BOTTOM) {
            phi = Math.acos(cosphi);
            lp.phi = phi - HALF_PI;
            if (area.value === AREA_ENUM.AREA_0) {
              lp.lam = -theta + HALF_PI;
            } else if (area.value === AREA_ENUM.AREA_1) {
              lp.lam = -theta;
            } else if (area.value === AREA_ENUM.AREA_2) {
              lp.lam = -theta - HALF_PI;
            } else /* area.value == AREA_ENUM.AREA_3 */ {
              lp.lam = (theta < 0.0 ? -theta - SPI : -theta + SPI);
            }
          } else {
            /* Compute phi and lam via cartesian unit sphere coordinates. */
            var q, r, s;
            q = cosphi;
            t = q * q;
            if (t >= 1) {
              s = 0;
            } else {
              s = Math.sqrt(1 - t) * Math.sin(theta);
            }
            t += s * s;
            if (t >= 1) {
              r = 0;
            } else {
              r = Math.sqrt(1 - t);
            }
            /* Rotate q,r,s into the correct area. */
            if (area.value === AREA_ENUM.AREA_1) {
              t = r;
              r = -s;
              s = t;
            } else if (area.value === AREA_ENUM.AREA_2) {
              r = -r;
              s = -s;
            } else if (area.value === AREA_ENUM.AREA_3) {
              t = r;
              r = s;
              s = -t;
            }
            /* Rotate q,r,s into the correct cube face. */
            if (this.face === FACE_ENUM.RIGHT) {
              t = q;
              q = -r;
              r = t;
            } else if (this.face === FACE_ENUM.BACK) {
              q = -q;
              r = -r;
            } else if (this.face === FACE_ENUM.LEFT) {
              t = q;
              q = r;
              r = -t;
            }
            /* Now compute phi and lam from the unit sphere coordinates. */
            lp.phi = Math.acos(-s) - HALF_PI;
            lp.lam = Math.atan2(r, q);
            if (this.face === FACE_ENUM.RIGHT) {
              lp.lam = qsc_shift_lon_origin(lp.lam, -HALF_PI);
            } else if (this.face === FACE_ENUM.BACK) {
              lp.lam = qsc_shift_lon_origin(lp.lam, -SPI);
            } else if (this.face === FACE_ENUM.LEFT) {
              lp.lam = qsc_shift_lon_origin(lp.lam, +HALF_PI);
            }
          }

          /* Apply the shift from the sphere to the ellipsoid as described
           * in [LK12]. */
          if (this.es !== 0) {
            var invert_sign;
            var tanphi, xa;
            invert_sign = (lp.phi < 0 ? 1 : 0);
            tanphi = Math.tan(lp.phi);
            xa = this.b / Math.sqrt(tanphi * tanphi + this.one_minus_f_squared);
            lp.phi = Math.atan(Math.sqrt(this.a * this.a - xa * xa) / (this.one_minus_f * xa));
            if (invert_sign) {
              lp.phi = -lp.phi;
            }
          }

          lp.lam += this.long0;
          p.x = lp.lam;
          p.y = lp.phi;
          return p;
        }

        /* Helper function for forward projection: compute the theta angle
         * and determine the area number. */
        function qsc_fwd_equat_face_theta(phi, y, x, area) {
          var theta;
          if (phi < EPSLN) {
            area.value = AREA_ENUM.AREA_0;
            theta = 0.0;
          } else {
            theta = Math.atan2(y, x);
            if (Math.abs(theta) <= FORTPI) {
              area.value = AREA_ENUM.AREA_0;
            } else if (theta > FORTPI && theta <= HALF_PI + FORTPI) {
              area.value = AREA_ENUM.AREA_1;
              theta -= HALF_PI;
            } else if (theta > HALF_PI + FORTPI || theta <= -(HALF_PI + FORTPI)) {
              area.value = AREA_ENUM.AREA_2;
              theta = (theta >= 0.0 ? theta - SPI : theta + SPI);
            } else {
              area.value = AREA_ENUM.AREA_3;
              theta += HALF_PI;
            }
          }
          return theta;
        }

        /* Helper function: shift the longitude. */
        function qsc_shift_lon_origin(lon, offset) {
          var slon = lon + offset;
          if (slon < -SPI) {
            slon += TWO_PI;
          } else if (slon > +SPI) {
            slon -= TWO_PI;
          }
          return slon;
        }

        var names$28 = ["Quadrilateralized Spherical Cube", "Quadrilateralized_Spherical_Cube", "qsc"];
        var qsc = {
          init: init$27,
          forward: forward$26,
          inverse: inverse$26,
          names: names$28
        };

        // Robinson projection
        // Based on https://github.com/OSGeo/proj.4/blob/master/src/PJ_robin.c
        // Polynomial coeficients from http://article.gmane.org/gmane.comp.gis.proj-4.devel/6039

        var COEFS_X = [
          [1.0000, 2.2199e-17, -7.15515e-05, 3.1103e-06],
          [0.9986, -0.000482243, -2.4897e-05, -1.3309e-06],
          [0.9954, -0.00083103, -4.48605e-05, -9.86701e-07],
          [0.9900, -0.00135364, -5.9661e-05, 3.6777e-06],
          [0.9822, -0.00167442, -4.49547e-06, -5.72411e-06],
          [0.9730, -0.00214868, -9.03571e-05, 1.8736e-08],
          [0.9600, -0.00305085, -9.00761e-05, 1.64917e-06],
          [0.9427, -0.00382792, -6.53386e-05, -2.6154e-06],
          [0.9216, -0.00467746, -0.00010457, 4.81243e-06],
          [0.8962, -0.00536223, -3.23831e-05, -5.43432e-06],
          [0.8679, -0.00609363, -0.000113898, 3.32484e-06],
          [0.8350, -0.00698325, -6.40253e-05, 9.34959e-07],
          [0.7986, -0.00755338, -5.00009e-05, 9.35324e-07],
          [0.7597, -0.00798324, -3.5971e-05, -2.27626e-06],
          [0.7186, -0.00851367, -7.01149e-05, -8.6303e-06],
          [0.6732, -0.00986209, -0.000199569, 1.91974e-05],
          [0.6213, -0.010418, 8.83923e-05, 6.24051e-06],
          [0.5722, -0.00906601, 0.000182, 6.24051e-06],
          [0.5322, -0.00677797, 0.000275608, 6.24051e-06]
        ];

        var COEFS_Y = [
          [-5.20417e-18, 0.0124, 1.21431e-18, -8.45284e-11],
          [0.0620, 0.0124, -1.26793e-09, 4.22642e-10],
          [0.1240, 0.0124, 5.07171e-09, -1.60604e-09],
          [0.1860, 0.0123999, -1.90189e-08, 6.00152e-09],
          [0.2480, 0.0124002, 7.10039e-08, -2.24e-08],
          [0.3100, 0.0123992, -2.64997e-07, 8.35986e-08],
          [0.3720, 0.0124029, 9.88983e-07, -3.11994e-07],
          [0.4340, 0.0123893, -3.69093e-06, -4.35621e-07],
          [0.4958, 0.0123198, -1.02252e-05, -3.45523e-07],
          [0.5571, 0.0121916, -1.54081e-05, -5.82288e-07],
          [0.6176, 0.0119938, -2.41424e-05, -5.25327e-07],
          [0.6769, 0.011713, -3.20223e-05, -5.16405e-07],
          [0.7346, 0.0113541, -3.97684e-05, -6.09052e-07],
          [0.7903, 0.0109107, -4.89042e-05, -1.04739e-06],
          [0.8435, 0.0103431, -6.4615e-05, -1.40374e-09],
          [0.8936, 0.00969686, -6.4636e-05, -8.547e-06],
          [0.9394, 0.00840947, -0.000192841, -4.2106e-06],
          [0.9761, 0.00616527, -0.000256, -4.2106e-06],
          [1.0000, 0.00328947, -0.000319159, -4.2106e-06]
        ];

        var FXC = 0.8487;
        var FYC = 1.3523;
        var C1 = R2D / 5; // rad to 5-degree interval
        var RC1 = 1 / C1;
        var NODES = 18;

        var poly3_val = function (coefs, x) {
          return coefs[0] + x * (coefs[1] + x * (coefs[2] + x * coefs[3]));
        };

        var poly3_der = function (coefs, x) {
          return coefs[1] + x * (2 * coefs[2] + x * 3 * coefs[3]);
        };

        function newton_rapshon(f_df, start, max_err, iters) {
          var x = start;
          for (; iters; --iters) {
            var upd = f_df(x);
            x -= upd;
            if (Math.abs(upd) < max_err) {
              break;
            }
          }
          return x;
        }

        function init$28() {
          this.x0 = this.x0 || 0;
          this.y0 = this.y0 || 0;
          this.long0 = this.long0 || 0;
          this.es = 0;
          this.title = this.title || "Robinson";
        }

        function forward$27(ll) {
          var lon = adjust_lon(ll.x - this.long0);

          var dphi = Math.abs(ll.y);
          var i = Math.floor(dphi * C1);
          if (i < 0) {
            i = 0;
          } else if (i >= NODES) {
            i = NODES - 1;
          }
          dphi = R2D * (dphi - RC1 * i);
          var xy = {
            x: poly3_val(COEFS_X[i], dphi) * lon,
            y: poly3_val(COEFS_Y[i], dphi)
          };
          if (ll.y < 0) {
            xy.y = -xy.y;
          }

          xy.x = xy.x * this.a * FXC + this.x0;
          xy.y = xy.y * this.a * FYC + this.y0;
          return xy;
        }

        function inverse$27(xy) {
          var ll = {
            x: (xy.x - this.x0) / (this.a * FXC),
            y: Math.abs(xy.y - this.y0) / (this.a * FYC)
          };

          if (ll.y >= 1) { // pathologic case
            ll.x /= COEFS_X[NODES][0];
            ll.y = xy.y < 0 ? -HALF_PI : HALF_PI;
          } else {
            // find table interval
            var i = Math.floor(ll.y * NODES);
            if (i < 0) {
              i = 0;
            } else if (i >= NODES) {
              i = NODES - 1;
            }
            for (;;) {
              if (COEFS_Y[i][0] > ll.y) {
                --i;
              } else if (COEFS_Y[i + 1][0] <= ll.y) {
                ++i;
              } else {
                break;
              }
            }
            // linear interpolation in 5 degree interval
            var coefs = COEFS_Y[i];
            var t = 5 * (ll.y - coefs[0]) / (COEFS_Y[i + 1][0] - coefs[0]);
            // find t so that poly3_val(coefs, t) = ll.y
            t = newton_rapshon(function (x) {
              return (poly3_val(coefs, x) - ll.y) / poly3_der(coefs, x);
            }, t, EPSLN, 100);

            ll.x /= poly3_val(COEFS_X[i], t);
            ll.y = (5 * i + t) * D2R;
            if (xy.y < 0) {
              ll.y = -ll.y;
            }
          }

          ll.x = adjust_lon(ll.x + this.long0);
          return ll;
        }

        var names$29 = ["Robinson", "robin"];
        var robin = {
          init: init$28,
          forward: forward$27,
          inverse: inverse$27,
          names: names$29
        };

        function init$29() {
          this.name = 'geocent';

        }

        function forward$28(p) {
          var point = geodeticToGeocentric(p, this.es, this.a);
          return point;
        }

        function inverse$28(p) {
          var point = geocentricToGeodetic(p, this.es, this.a, this.b);
          return point;
        }

        var names$30 = ["Geocentric", 'geocentric', "geocent", "Geocent"];
        var geocent = {
          init: init$29,
          forward: forward$28,
          inverse: inverse$28,
          names: names$30
        };

        var includedProjections = function (proj4) {
          proj4.Proj.projections.add(tmerc);
          proj4.Proj.projections.add(etmerc);
          proj4.Proj.projections.add(utm);
          proj4.Proj.projections.add(sterea);
          proj4.Proj.projections.add(stere);
          proj4.Proj.projections.add(somerc);
          proj4.Proj.projections.add(omerc);
          proj4.Proj.projections.add(lcc);
          proj4.Proj.projections.add(krovak);
          proj4.Proj.projections.add(cass);
          proj4.Proj.projections.add(laea);
          proj4.Proj.projections.add(aea);
          proj4.Proj.projections.add(gnom);
          proj4.Proj.projections.add(cea);
          proj4.Proj.projections.add(eqc);
          proj4.Proj.projections.add(poly);
          proj4.Proj.projections.add(nzmg);
          proj4.Proj.projections.add(mill);
          proj4.Proj.projections.add(sinu);
          proj4.Proj.projections.add(moll);
          proj4.Proj.projections.add(eqdc);
          proj4.Proj.projections.add(vandg);
          proj4.Proj.projections.add(aeqd);
          proj4.Proj.projections.add(ortho);
          proj4.Proj.projections.add(qsc);
          proj4.Proj.projections.add(robin);
          proj4.Proj.projections.add(geocent);
        };

        proj4$1.defaultDatum = 'WGS84'; //default datum
        proj4$1.Proj = Projection;
        proj4$1.WGS84 = new proj4$1.Proj('WGS84');
        proj4$1.Point = Point;
        proj4$1.toPoint = toPoint;
        proj4$1.defs = defs;
        proj4$1.transform = transform;
        proj4$1.mgrs = mgrs;
        proj4$1.version = '2.6.1';
        includedProjections(proj4$1);

        return proj4$1;

      })));

    }, {}],
    42: [function (require, module, exports) {
      (function (process) {
        'use strict';
        var buffs = require('./read');
        var reader = require('./nodeReader');
        var fromZip = require('./fromZip');
        var binaryAjax = require('./binaryAjax');
        module.exports = function () {
          if (arguments.length === 2) {
            return buffs(arguments[0], arguments[1]);
          }
          if (typeof arguments[0] === 'string') {
            if (process.browser) {
              return binaryAjax(arguments[0]).then(fromZip);
            } else {
              return reader(arguments[0]);
            }
          }
          if (process.browser && arguments[0].toString() === '[object FileList]') {
            return reader(arguments[0]);
          }
          return fromZip(arguments[0]);
        };

      }).call(this, require('_process'))
    }, {
      "./binaryAjax": 1,
      "./fromZip": 6,
      "./nodeReader": 2,
      "./read": 8,
      "_process": 40
    }]
  }, {}, [42])(42)
});