/*
 * Copyright (c) 2015 Jason Lai
 * License: MIT
 */

(function () {
  var jcrop_api;
  var coords;
  var resultsReady = false;

  var PALETTE = [
    [85, 255, 0], [85, 170, 255], [85, 170, 0], [85, 85, 255], [85, 170,
    170], [85, 170, 85], [85, 85, 0], [85, 0, 255], [85, 85, 170], [85,
    85, 85], [255, 255, 0], [170, 85, 170], [255, 0, 0], [170, 255, 255],
    [170, 255, 170], [170, 255, 85], [170, 255, 0], [170, 170, 255], [170,
    170, 170], [170, 170, 85], [170, 170, 0], [170, 85, 255], [255, 255,
    85], [255, 170, 255], [85, 255, 255], [0, 85, 255], [0, 170, 0], [170,
    0, 0], [0, 0, 85], [0, 0, 170], [0, 0, 0], [255, 255, 255], [0, 85,
    85], [0, 85, 170], [0, 0, 255], [0, 85, 0], [0, 170, 85], [0, 170,
    170], [0, 170, 255], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0,
    255, 255], [85, 0, 0], [85, 0, 85], [85, 0, 170], [85, 255, 85], [85,
    255, 170], [170, 0, 255], [170, 85, 0], [170, 0, 85], [170, 0, 170],
    [255, 170, 85], [255, 170, 170], [255, 85, 85], [255, 85, 170], [255,
    85, 255], [255, 170, 0], [255, 0, 85], [255, 0, 170], [255, 0, 255],
    [255, 85, 0], [255, 255, 170], [170, 85, 85]
  ];

  var ditherTypes = [
    'FloydSteinberg',
    'FalseFloydSteinberg',
    'Stucki',
    'Atkinson',
    'Jarvis',
    'Burkes',
    'Sierra',
    'TwoSierra',
    'SierraLite'
  ];

  var filterTypes = [
    'brightness', 'contrast', 'gamma', 'rgbadjust', 'saturation', 'vignette'
  ];

  var filterDefaults = {
    vignette: {
      amount: 0
    }
  };

    function createCanvas (w, h) {
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function quantizeToCanvas (image, type, options) {
    var canvas = createCanvas(144, 168);
    var context = canvas.getContext('2d');

    options = options || {};
    options.useCache = false;
    options.bw = getBW();

    if (options.bw) {
      options.palette = [[0,0,0], [255,255,255]];
    } else {
      options.palette = options.palette || PALETTE;
    }

    var q = new RgbQuant(options);
    var i8 = q.reduce(image, 1, type, options.dithSerp);

    var imageData = context.createImageData(144, 168);
    var data = imageData.data;

    for (var i = 0; i < i8.length; i++) {
      data[i] = i8[i];
    }

    context.putImageData(imageData, 0, 0);

    return canvas;
  }

  function setupCrop() {
    $('#crop').Jcrop({
      aspectRatio: 144.0/168.0,
      minSize: [144, 168],
      boxWidth: 200,
      boxHeight: 200,
      setSelect: [0, 0, 99999, 99999],

      onSelect: function (c) {
        coords = c;
        render();
      },
      onChange: function () {},
    }, function () {
      jcrop_api = this;
    });
  }

  function getDitherDelta () {
    return parseFloat($('#dither-threshold').val())/100.0;
  }

  function getDitherSerp () {
    return $('#dither-serp').is(':checked');
  }

  function getBW () {
    return $('#dither-bw').is(':checked');
  }

  function getFloatValue (id) {
    return parseFloat($('#' + id).val());
  }

  function updateFilterParam (target) {
    if (target && target.id) {
      $('#' + target.id + '-number').text(getFloatValue(target.id));
    }
    render();
  }

  function applyFilters(data) {
    filterTypes.forEach(function (filterName) {
      var filter = JSManipulate[filterName];
      var values = {};

      _.each(filter.valueRanges, function (value, key) {
        values[key] = getFloatValue(filterName + '-' + key);
      });

      console.log('applying ' + filterName + ': ' + JSON.stringify(values));
      filter.filter(data, values);
    });
  }

  function render () {
    var options = {
      dithDelta: getDitherDelta(),
      dithSerp: getDitherSerp()
    };

    console.log(options);

    var image = $('#crop').get(0);

    var canvas = createCanvas(144, 168);
    var context = canvas.getContext('2d');

    if (coords.x < 0 || coords.x + coords.w > image.width) {
      coords.x = 0;
      coords.w = image.width;
    }

    if (coords.y < 0 || coords.y + coords.h > image.height) {
      coords.y = 0;
      coords.h = image.height;
    }

    // resize
    context.drawImage(
      image, coords.x, coords.y, coords.w, coords.h,
      0, 0, 144, 168
     );

    // apply effects
    var data = context.getImageData(0, 0, canvas.width, canvas.height);
    applyFilters(data);
    context.putImageData(data, 0, 0);

    if (!resultsReady) {
      setupResults();
      resultsReady = true;
    }

    ditherTypes.forEach(function (type) {
      var image = quantizeToCanvas(context, type, options).toDataURL('image/png');
      $('#' + type + '-result').attr('src', image);
    });
  }

  function setupResults () {
    var resultsTemplate = Handlebars.compile($("#results-template").html());
    $('#results').html(resultsTemplate({ditherTypes: ditherTypes}));
  }

  function setupFilters () {
    var filters = [];

    filterTypes.forEach(function (filterName) {
      var filter = JSManipulate[filterName];

      if (!filter) throw new Error('no filter ' + filterName);

      var params = _.map(filter.valueRanges, function (value, key) {
        var defaultValue = filter.defaultValues[key];

        if (filterDefaults[filterName]) {
          defaultValue = filterDefaults[filterName][key];
        }

        return {
          desc: key === 'amount' ? filter.name : (filter.name + ' ' + _.capitalize(key)),
          param: key, min: value.min, max: value.max, default: defaultValue
        };
      });

      filters.push({
        type: filterName,
        name: filter.name,
        params: params
      });
    });

    var filtersTemplate = Handlebars.compile($("#filters-template").html());
    $('#settings').append(filtersTemplate({filters: filters}));
  }

  $(document).ready(function () {
    console.log('ready');

    setupFilters();

    $('#filepicker').change(function () {
      var file = this.files[0];
      var blobURL = file && URL.createObjectURL(file);

      if (jcrop_api) {
        jcrop_api.destroy();
        jcrop_api = null;
      }

      $('#crop').get(0).style.width = 'inherit';
      $('#crop').get(0).style.height = 'inherit';
      $('#crop').attr('src', blobURL);

      $('#crop').load(function () {
        setupCrop();
      });
    });

    $('#dither-threshold').change(function () {
      $('#delta-percent').text(Math.floor(getDitherDelta() * 10000)/100 + '%');
      render();
    });

    setupCrop();
  });

  // Public functions
  window.render = render;
  window.updateFilterParam = updateFilterParam;
})();
