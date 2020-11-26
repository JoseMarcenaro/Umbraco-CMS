/**
* @ngdoc directive
* @name umbraco.directives.directive:umbImageCrop
* @restrict E
* @function
**/
angular.module("umbraco.directives")
    .directive('umbImageCrop',
        function ($timeout, $window, cropperHelper) {
            return {
                restrict: 'E',
                replace: true,
                templateUrl: 'views/components/imaging/umb-image-crop.html',
                scope: {
                    src: '=',
                    width: '@',
                    height: '@',
                    crop: "=",
                    center: "=",
                    maxSize: '@',
                    alias: '@?',
                    forceUpdate: '@?'
                },

                link: function (scope, element, attrs) {

                    var unsubscribe = [];
                    let sliderRef = null;

                    scope.loaded = false;
                    scope.width = 0;
                    scope.height = 0;

                    scope.dimensions = {
                        element: {},
                        image: {},
                        cropper: {},
                        viewport: {},
                        margin: {},
                        scale: {
                            min: 0,
                            max: 3,
                            current: 1
                        }
                    };

                    scope.sliderOptions = {
                        "start": scope.dimensions.scale.current,
                        "step": 0.001,
                        "tooltips": [false],
                        "format": {
                            to: function (value) {
                                return parseFloat(parseFloat(value).toFixed(3));
                            },
                            from: function (value) {
                                return parseFloat(parseFloat(value).toFixed(3));
                            }
                        },
                        "range": {
                            "min": scope.dimensions.scale.min,
                            "max": scope.dimensions.scale.max
                        }
                    };

                    scope.setup = function (slider) {
                        sliderRef = slider;
                        updateSlider();
                    };

                    function updateSlider() {
                        if(sliderRef) {
                            // Set slider handle position
                            sliderRef.noUiSlider.set(scope.dimensions.scale.current);

                            // Update slider range min/max
                            sliderRef.noUiSlider.updateOptions({
                                "range": {
                                    "min": scope.dimensions.scale.min,
                                    "max": scope.dimensions.scale.max
                                }
                            });
                        }
                    }

                    scope.slide = function (values) {
                        if (values) {
                            scope.dimensions.scale.current = parseFloat(values);
                        }
                    };

                    scope.change = function (values) {
                        if (values) {
                            scope.dimensions.scale.current = parseFloat(values);
                        }
                    };


                    //live rendering of viewport and image styles
                    function updateStyles() {
                        /*
                        scope.viewportStyle = {
                            'top': (parseInt(scope.dimensions.image.top + scope.dimensions.margin.top, 10)) + 'px',
                            'left': (parseInt(scope.dimensions.image.left + scope.dimensions.margin.left, 10)) + 'px',
                            'width': (parseInt(scope.dimensions.image.width, 10)) + 'px',
                            'height': (parseInt(scope.dimensions.image.height, 10)) + 'px'
                        };
                        */
                        scope.maskStyle = {
                            'height': (parseInt(scope.dimensions.cropper.height, 10)) + 'px',
                            'width': (parseInt(scope.dimensions.cropper.width, 10)) + 'px',
                            'top': (parseInt(scope.dimensions.margin.top, 10)) + 'px',
                            'left': (parseInt(scope.dimensions.margin.left, 10)) + 'px'
                        }
                    };
                    updateStyles();


                    //elements
                    var $viewport = element.find(".viewport");
                    var $image = element.find("img");
                    var $overlay = element.find(".overlay");
                    //var $container = element.find(".crop-container");

                    //default constraints for drag n drop
                    var constraints = { left: { max: 0, min: 0 }, top: { max: 0, min: 0 } };
                    scope.constraints = constraints;


                    //set constaints for cropping drag and drop
                    var setConstraints = function () {
                        constraints.left.min = scope.dimensions.cropper.width - scope.dimensions.image.width;
                        constraints.top.min = scope.dimensions.cropper.height - scope.dimensions.image.height;
                    };

                    var setDimensions = function () {

                        scope.dimensions.image.width = scope.dimensions.image.originalWidth;
                        scope.dimensions.image.height = scope.dimensions.image.originalHeight;

                        //unscaled editor size
                        var _cropW = parseInt(scope.width, 10);
                        var _cropH = parseInt(scope.height, 10);

                        //if we set a constraint we will scale it down if needed
                        if (scope.maxSize) {
                            if (scope.maxSize < scope.dimensions.viewport.width) {
                                $viewport.css("width", parseInt(scope.maxSize, 10) + "px");
                                scope.dimensions.viewport.width = scope.maxSize;
                            }
                            if (scope.maxSize < scope.dimensions.viewport.height) {
                                $viewport.css("height", parseInt(scope.maxSize, 10) + "px");
                                scope.dimensions.viewport.height = scope.maxSize;
                            }
                        }

                        var ratioCalculation = cropperHelper.scaleToMaxSize(
                            _cropW,
                            _cropH,
                            scope.dimensions.viewport.width - 40,
                            scope.dimensions.viewport.height - 40);

                        //so if we have a max size, override the thumb sizes
                        _cropW = ratioCalculation.width;
                        _cropH = ratioCalculation.height;

                        // set margins:
                        scope.dimensions.margin.left = (scope.dimensions.viewport.width - _cropW) * 0.5;
                        scope.dimensions.margin.top = (scope.dimensions.viewport.height - _cropH) * 0.5;

                        scope.dimensions.cropper.width = _cropW;
                        scope.dimensions.cropper.height = _cropH;
                        updateStyles();
                    };

                    //resize to a given ratio
                    var resizeImageToScale = function (ratio) {

                        var prevWidth = scope.dimensions.image.width;
                        var prevHeight = scope.dimensions.image.height;

                        scope.dimensions.image.width = scope.dimensions.image.originalWidth * ratio;
                        scope.dimensions.image.height = scope.dimensions.image.originalHeight * ratio;

                        var difW = (scope.dimensions.image.width - prevWidth);
                        var difH = (scope.dimensions.image.height - prevHeight);

                        // normalized focus point:
                        var focusNormX = (-scope.dimensions.image.left + scope.dimensions.cropper.width*.5) / prevWidth;
                        var focusNormY = (-scope.dimensions.image.top + scope.dimensions.cropper.height*.5) / prevHeight;

                        scope.dimensions.image.left = scope.dimensions.image.left - difW * focusNormX;
                        scope.dimensions.image.top = scope.dimensions.image.top - difH * focusNormY;

                        setConstraints();
                        validatePosition(scope.dimensions.image.left, scope.dimensions.image.top);
                    };

                    //resize the image to a predefined crop coordinate
                    var resizeImageToCrop = function () {
                        scope.dimensions.image = cropperHelper.convertToStyle(
                            runtimeCrop,
                            { width: scope.dimensions.image.originalWidth, height: scope.dimensions.image.originalHeight },
                            scope.dimensions.cropper,
                            0);

                        var ratioCalculation = cropperHelper.calculateAspectRatioFit(
                            scope.dimensions.image.originalWidth,
                            scope.dimensions.image.originalHeight,
                            scope.dimensions.cropper.width,
                            scope.dimensions.cropper.height,
                            true);

                        scope.dimensions.scale.current = scope.dimensions.image.ratio;

                        // Update min and max based on original width/height
                        scope.dimensions.scale.min = ratioCalculation.ratio;
                        scope.dimensions.scale.max = ratioCalculation.ratio * 3;

                        updateSlider();
                    };

                    var validatePosition = function (left, top) {

                        left = Math.min(Math.max(left, constraints.left.min), constraints.left.max);
                        top = Math.min(Math.max(top, constraints.top.min), constraints.top.max);

                        if (scope.dimensions.image.left !== left) {
                            scope.dimensions.image.left = left;
                        }

                        if (scope.dimensions.image.top !== top) {
                            scope.dimensions.image.top = top;
                        }
                    };


                    //sets scope.crop to the recalculated % based crop
                    function calculateCropBox() {
                        runtimeCrop = cropperHelper.pixelsToCoordinates(scope.dimensions.image, scope.dimensions.cropper.width, scope.dimensions.cropper.height, 0);
                    };
                    function saveCropBox() {
                        scope.crop = Utilities.copy(runtimeCrop);
                    }


                    //Drag and drop positioning, using jquery ui draggable
                    //var onStartDragPosition, top, left;
                    var dragStartPosition = {};
                    $overlay.draggable({
                        start: function (event, ui) {
                            dragStartPosition.left = scope.dimensions.image.left;
                            dragStartPosition.top = scope.dimensions.image.top;
                        },
                        drag: function (event, ui) {
                            scope.$apply(function () {
                                validatePosition(dragStartPosition.left + (ui.position.left - ui.originalPosition.left), dragStartPosition.top + (ui.position.top - ui.originalPosition.top));
                            });
                        },
                        stop: function (event, ui) {
                            scope.$apply(function () {
                                //make sure that every validates one more time...
                                validatePosition(dragStartPosition.left + (ui.position.left - ui.originalPosition.left), dragStartPosition.top + (ui.position.top - ui.originalPosition.top));

                                calculateCropBox();
                                saveCropBox();
                            });
                        }
                    });

                    var runtimeCrop;
                    var init = function () {

                        // store original size:
                        scope.dimensions.image.originalWidth = $image.width();
                        scope.dimensions.image.originalHeight = $image.height();

                        // runtime Crop, should not be saved until we have interactions:
                        runtimeCrop = Utilities.copy(scope.crop);

                        onViewportSizeChanged();

                        scope.loaded = true;
                    };

                    function setCrop() {
                        //create a default crop if we haven't got one already
                        var createDefaultCrop = !scope.crop;
                        if (createDefaultCrop) {
                            calculateCropBox();
                        }

                        resizeImageToCrop();

                        //if we're creating a new crop, make sure to zoom out fully
                        if (createDefaultCrop) {
                            scope.dimensions.scale.current = scope.dimensions.scale.min;
                            resizeImageToScale(scope.dimensions.scale.min);

                            if (scope.center) {
                                // Move image to focal point if set
                                // Repeating a few calls here, but logic is too difficult to follow elsewhere
                                var x1 = Math.min(
                                    Math.max(
                                        scope.center.left * scope.dimensions.image.width - scope.dimensions.cropper.width / 2,
                                        0
                                    ),
                                    scope.dimensions.image.width - scope.dimensions.cropper.width
                                );
                                var y1 = Math.min(
                                    Math.max(
                                        scope.center.top * scope.dimensions.image.height - scope.dimensions.cropper.height / 2,
                                        0
                                    ),
                                    scope.dimensions.image.height - scope.dimensions.cropper.height
                                );
                                scope.dimensions.image.left = x1;
                                scope.dimensions.image.top = y1;
                                calculateCropBox();
                                resizeImageToCrop();
                            }
                        }
                    }


                    function onViewportSizeChanged() {
                        scope.dimensions.viewport.width = $viewport.width();
                        scope.dimensions.viewport.height = $viewport.height();

                        setDimensions();
                        setCrop();
                        setConstraints();
                    }


                    // Watchers
                    unsubscribe.push(scope.$watchCollection('[width, height, alias, forceUpdate]', function (newValues, oldValues) {
                        // We have to reinit the whole thing if
                        // one of the external params changes
                        if (newValues !== oldValues) {
                            runtimeCrop = Utilities.copy(scope.crop);
                            setDimensions();
                            setCrop();
                            setConstraints();
                        }
                    }));

                    var throttledResizing = _.throttle(function () {
                        resizeImageToScale(scope.dimensions.scale.current);
                        calculateCropBox();
                        saveCropBox();
                    }, 15);

                    // Happens when we change the scale
                    unsubscribe.push(scope.$watch("dimensions.scale.current", function (newValue, oldValue) {
                        if (scope.loaded) {
                            throttledResizing();
                        }
                    }));

                    // Init
                    $image.on("load", function () {
                        $timeout(function () {
                            init();
                        });
                    });

                    $window.addEventListener("resize", onViewportSizeChanged)

                    scope.$on('$destroy', function () {
                        console.log("DESTROY!!");
                        $image.prop("src", "");
                        $window.removeEventListener("resize", onViewportSizeChanged)
                        unsubscribe.forEach(u => u());
                    })
                }
            };
        });
