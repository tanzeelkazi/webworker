﻿/*eslint no-native-reassign:0 */
(function ($) {
    'use strict';

    /**
     * The WebWorker module.
     * @module WebWorker
     */
    var WebWorker = null,
        _WebWorker = null,
        NativeWorker = null,

        context = null,
        className = null,

        defaultContext = window,
        defaultClassName = 'WebWorker',

        Action = null,

        Event = null,
        eventPrefix = 'webworker:',

        EventMap = null,

        Error = null,

        slice = null,

        key = null;

    context = context || defaultContext;
    className = className || defaultClassName;

    WebWorker = context[className] || null;

    if (WebWorker !== null) {
        _WebWorker = WebWorker;
    }

    slice = Array.prototype.slice;
    NativeWorker = window.Worker;

    /**
     * The main WebWorker class.
     * @class WebWorker
     * @constructor
     * @param {Object|String} opts
     *            The options to be passed into the constructor.
     *            <br />
     *            If you pass a `String`, the code will first search
     *            for an element selector with the worker script.
     *            If it does not find the element it will then use
     *            it as a URL to the actual worker script.
     */
    WebWorker = function () {
        this._constructor.apply(this, arguments);
        return;
    };

    /**
     * A jQuery object created from the webworker instance.
     * @property _$
     * @private
     * @type {jQuery}
     * @default $(this)
     * @readOnly
     */
    WebWorker.prototype._$ = null;


    /**
     * The worker URL (if provided)
     * @property _workerUrl
     * @type {String}
     * @private
     * @default null
     */
    WebWorker.prototype._workerUrl = null;

    /**
     * The `Blob` URL generated for the worker.
     * @property _workerBlobUrl
     * @type {String}
     * @private
     * @default null
     */
    WebWorker.prototype._workerBlobUrl = null;

    /**
     * The worker script contents (cached for further use).
     * @property _workerScript
     * @type {String}
     * @private
     * @default null
     */
    WebWorker.prototype._workerScript = null;

    /**
     * The native browser worker object. This is generated once the worker is loaded.
     * @property _nativeWorker
     * @type {Object}
     * @private
     * @default null
     */
    WebWorker.prototype._nativeWorker = null;

    /**
     * Store the last error generated by the worker instance.
     * @property _lastError
     * @type {String}
     * @private
     * @default null
     */
    WebWorker.prototype._lastError = null;

    /**
     * Indicates if the worker script has loaded.
     * This is set to `true` once the worker script has
     * successfully loaded after the `.load()` method call.
     * @property _hasLoaded
     * @type {Boolean}
     * @private
     * @default false
     */
    WebWorker.prototype._hasLoaded = false;

    /**
     * Since `WebWorker` terminate calls are asynchronous,
     * this is used to keep track of whether a terminate call
     * was initialized.
     * @property _isTerminateInitialized
     * @type {Boolean}
     * @private
     * @default false
     */
    WebWorker.prototype._isTerminateInitialized = false;

    /**
     * The main constructor calls this method. This method
     * was moved out of the main constructor to keep the
     * code clean.
     * @method _constructor
     * @param {Object} opts* Arguments to the main constructor
     * @private
     */
    WebWorker.prototype._constructor = function (opts) {
        var $scriptElement = null,
            scriptContents = null,
            workerUrl = null;

        Object.defineProperty(this, '_$', {
            "configurable": false,
            "enumerable": true,
            "value": $(this),
            "writable": false
        });

        opts = opts || null;

        if (opts === null) {
            this.throwError(Error.INVALID_ARGUMENTS, null, true);
        }

        if (typeof opts === 'string') {
            opts = $.trim(opts);

            try {
                $scriptElement = $(opts);
            } catch (err) {
                // Cannot be resolved as a selector
            }

            if ($scriptElement !== null && $scriptElement.length > 0) {
                // Matching script element found
                // Cache its contents
                scriptContents = $scriptElement.text();
                this._workerScript = scriptContents;
            } else {
                workerUrl = opts;
            }
        }

        this._workerUrl = workerUrl;

        this._assignEventHandlers();

        this.trigger(Event.INITIALIZED);

        return;
    };

    /**
     * Returns the worker URL if one was provided during object instantiation.
     * @method getUrl
     * @return {String} The worker URL, `null` otherwise.
     */
    WebWorker.prototype.getUrl = function () {
        return this._workerUrl;
    };

    /**
     * Returns the worker blob URL if one has been generated.
     * @method getBlobUrl
     * @return {String} The worker blob URL, `null` otherwise.
     */
    WebWorker.prototype.getBlobUrl = function () {
        return this._workerBlobUrl;
    };

    /**
     * Returns the native browser worker instance if one has been generated.
     * @method getNativeWorker
     * @return {Object} The native worker instance, `null` otherwise.
     */
    WebWorker.prototype.getNativeWorker = function () {
        return this._nativeWorker;
    };

    /**
     * Returns whether the worker script has been loaded.
     * @method hasLoaded
     * @return {Boolean} Returns `true` if the worker script has loaded, `false` otherwise.
     */
    WebWorker.prototype.hasLoaded = function () {
        return this._hasLoaded;
    };

    /**
     * Triggers the instance to load the worker script and generate a native browser worker.
     * @method load
     * @chainable
     */
    WebWorker.prototype.load = function () {
        var self = this,
            workerUrl = null,
            onScriptLoaded = null;

        // Trigger event
        self.trigger(Event.WORKER_LOADING);

        workerUrl = self.getUrl() || null;
        onScriptLoaded = function () {
            var blob = null,
                scriptContents = null;

            scriptContents = self._workerScript;
            scriptContents = WebWorker._workerScriptWrapper.replace(/\{\{main-function\}\}/g, scriptContents);

            blob = new window.Blob([scriptContents], {
                "type": "text/javascript"
            });
            self._workerBlobUrl = window.URL.createObjectURL(blob);

            self._createWorker();

            return;
        };

        if (workerUrl === null) {
            // Script already available
            onScriptLoaded();
        } else {
            // Ajax request
            $.ajax({
                "async": true,
                "url": workerUrl,
                "dataType": 'text',
                "crossDomain": true,
                "success": function (responseText) {
                    self._workerScript = responseText;
                    onScriptLoaded();
                    return;
                },
                "error": function () {
                    self.throwError(Error.WORKER_DID_NOT_LOAD, arguments);
                    return;
                }
            });
        }

        return self;
    };

    /**
     * Generates the native browser worker and attaches the message parser to it.
     * @method _createWorker
     * @private
     * @chainable
     */
    WebWorker.prototype._createWorker = function () {
        var self = this;

        self._nativeWorker = new NativeWorker(self.getBlobUrl());

        self._attachMessageParser();

        return self;
    };

    /**
     * Assigns the basic internal event handlers to the worker instance.
     * @method _assignEventHandlers
     * @private
     * @chainable
     */
    WebWorker.prototype._assignEventHandlers = function () {
        var self = this;

        self.on(Event.ERROR, function () {
            console.log('error');
            console.log(arguments);
            return;
        });

        self.on(Event.WORKER_LOADED, function () {
            self._hasLoaded = true;
            return;
        });

        return self;
    };

    /**
     * Returns whether a worker terminate was initialized.
     * @method isTerminateInitialized
     * @return {Boolean} Returns `true` if a terminate has been initialized, `false` otherwise.
     */
    WebWorker.prototype.isTerminateInitialized = function () {
        return this._isTerminateInitialized;
    };

    /**
     * Start the worker (if it has loaded). Any arguments passed to this method
     * will be passed internally to the worker script.
     * <br />
     * Note that you should start the worker only AFTER it has loaded. If you call this
     * method before the worker has loaded it will fail silently.
     * @method start
     * @param {Mixed} args* Arguments to be passed internally to the worker
     *                      script.<br />
     *                      Please ensure that arguments are basic
     *                      objects that can be cloned by the browser
     *                      for `postMessage` interface.
     * @chainable
     */
    WebWorker.prototype.start = function () {
        var self = this,
            args = null;

        if (!self.hasLoaded()) {
            return self;
        }

        self.trigger(Event.WORKER_STARTING);

        args = slice.call(arguments);
        self.sendMessage(Action.START, args);

        return self;
    };

    /**
     * This method acts as the main communications interface with the worker and is used internally.
     * <br /><br />
     * **You are recommended to use the trigger interface _ONLY_ as it is the most reliable mode of
     * communication between the instance and the actual worker.**
     * <br /><br />
     * If you do understand the risks, you are welcome to use this method (a reason why it is
     * left public instead of private).
     * <br /><br />
     * It's basic usage is very simple. Specify the `action`, which is the
     * method name to call _inside_ the worker script, and the arguments to pass in. The worker
     * does the rest of the heavy lifting.
     * <br /><br />
     * Note: This method is NOT synchronous and will not warn you of any errors.
     * @method sendMessage
     * @param {String} action The name of the method within the worker script to call.
     * @param {Array} args The array of arguments to pass to the worker. Ensure that this data
     *                     can be cloned by the browser for the `postMessage` interface.
     * @chainable
     */
    WebWorker.prototype.sendMessage = function (action, args) {
        var self = this,
            nativeWorker = null,
            message = null;

        action = action || null;
        args = args || null;

        if (action === null) {
            return self;
        }

        message = {
            "__isWebWorkerMsg": true
        };

        message.action = action;
        message.args = args;

        nativeWorker = self.getNativeWorker();

        if (nativeWorker !== null) {
            nativeWorker.postMessage(message);
        }

        return self;
    };

    /**
     * Attaches the message parser to the native worker. This allows the worker to hook into
     * `postMessage` API and set up a communications protocol between the instance and the
     * native browser worker.
     * @method _attachMessageParser
     * @private
     * @chainable
     */
    WebWorker.prototype._attachMessageParser = function () {
        var self = this,
            nativeWorker = self.getNativeWorker();

        $(nativeWorker).on('message', function (event) {
            var originalEvent = event.originalEvent || event,
                msg = originalEvent.data,
                action = null,
                args = null;

            if (typeof msg === 'object'
                && '__isWebWorkerMsg' in msg
                && msg.__isWebWorkerMsg) {
                action = msg.action;
                args = msg.args;

                self[action].apply(self, args);
                return;
            }

            //window.console.log('message');
            //window.console.log(msg);

        });

        return self;
    };

    /**
     * This method triggers the worker to terminate. Terminating is ASYNCHRONOUS. This method
     * sets the ball rolling. It sends the message to the worker which may have a
     * `terminateHandler` that can do some cleanup operations before control is passed back
     * to the instance and the final terminate (`terminateNow`) is executed.
     * @method terminate
     * @chainable
     */
    WebWorker.prototype.terminate = function () {
        var self = this,
            nativeWorker = self.getNativeWorker() || null;

        if (nativeWorker !== null) {
            self._isTerminateInitialized = true;
            self.trigger(Event.WORKER_TERMINATING);
            self.sendMessage(Action.SET_TERMINATING_STATUS, [true]);
            self.sendMessage(Action.TERMINATE, slice.call(arguments));
        }

        return self;
    };

    /**
     * Terminates the worker _immediately_.
     * <br />
     * This method can be used to terminate the worker
     * _immediately_, instead of waiting for the asynchronous terminate cycle to complete.
     * <br />
     * It is also called internally once the asynchronous `terminate` cycle
     * passes control back to the instance to execute the final terminate.
     * @method terminateNow
     * @param {Mixed} [returnValue] This value is passed to with the data on the
     *                              WORKER_TERMINATED event. It is also used internally to
     *                              pass the return value of the `terminateHandler` from
     *                              the worker in the asynchronous terminate cycle.
     * @chainable
     */
    WebWorker.prototype.terminateNow = function (returnValue) {
        var self = this,
            nativeWorker = null;

        if (!self.isTerminateInitialized()) {
            self.trigger(Event.WORKER_TERMINATING);
        }

        nativeWorker = self.getNativeWorker() || null;

        if (nativeWorker !== null) {
            nativeWorker.terminate();
            self._hasLoaded = false;
            self._isTerminateInitialized = false;
            self._nativeWorker = null;
            self.trigger(Event.WORKER_TERMINATED, {"returnValue": returnValue});
        }

        return self;
    };

    /**
     * Used to bind event listeners to the worker. Internally it uses the jQuery `.on` method.
     * @method on
     * @param {Mixed} args* Lookup the jQuery `.on` API for argument list.
     * @chainable
     */
    WebWorker.prototype.on = function () {
        var $worker = this._$;
        $worker.on.apply($worker, arguments);
        return this;
    };

    /**
     * Used to bind event listeners to the worker for single execution. Internally it uses the jQuery `.one` method.
     * @method one
     * @param {Mixed} args* Lookup the jQuery `.one` API for argument list.
     * @chainable
     */
    WebWorker.prototype.one = function () {
        var $worker = this._$;
        $worker.one.apply($worker, arguments);
        return this;
    };

    /**
     * Used to unbind event listeners from the worker. Internally it uses the jQuery `.off` method.
     * @method off
     * @param {Mixed} args* Lookup the jQuery `.off` API for argument list.
     * @chainable
     */
    WebWorker.prototype.off = function () {
        var self = this,
            $worker = self._$;

        $worker.off.apply($worker, arguments);
        self._assignEventHandlers();

        return this;
    };

    /**
     * Used to trigger events on the worker. Internally it uses a combination of the jQuery `.trigger` method
     * and a custom trigger for triggering events on the native worker script.
     * <br /><br />
     * If an event type is recognized as an internal event type, the trigger is executed on the base instance
     * using jQuery. Otherwise the `.sendMessage` API is used to pass the trigger to the worker script.
     * @method trigger
     * @param {Object} event This can be a string `eventType` or an object `event`. Please ensure that if using
     *                       object events, that they are clonable by the browser for the `postMessage` API.
     * @chainable
     */
    WebWorker.prototype.trigger = function (event) {
        var self = this,
            passedEventString = false,
            eventType = null,
            eventArgs = null;

        if (typeof event === 'object') {
            eventType = event.type || null;
        }

        if (typeof event === 'string') {
            eventType = event || null;
            passedEventString = true;
        }

        if (eventType === null) {
            return self;
        }

        if (eventType in EventMap) {
            if (passedEventString) {
                event = new $.Event(eventType);
            }
            event.worker = self;
            eventArgs = [event];
            if (arguments.length > 1) {
                eventArgs = eventArgs.concat(slice.call(arguments, 1));
            }

            self._triggerSelf.apply(self, eventArgs);
            return self;
        }

        if (passedEventString) {
            event = {
                "type": eventType,
                "data": null
            };
        }
        eventArgs = [event];
        self.sendMessage(Action.TRIGGER_SELF, eventArgs);

        return self;
    };

    /**
     * You may want to trigger an event on the base worker instance irrespective of it's event type. Use this
     * method to achieve the same.
     * @method triggerSelf
     * @param {Object} event This can be a string `eventType` or an object `event`.
     * @chainable
     */
    WebWorker.prototype.triggerSelf = function (event) {
        var self = this,
            eventType = null,
            eventArgs = null;

        event = event || null;

        if (event === null) {
            return self;
        }

        if (typeof event === 'string') {
            eventType = event;
            event = new $.Event(eventType);
        }

        event.worker = self;
        eventArgs = [event];
        if (arguments.length > 1) {
            eventArgs = eventArgs.concat(slice.call(arguments, 1));
        }

        self._triggerSelf.apply(self, eventArgs);

        return self;
    };

    /**
     * Internal method to trigger events on the base worker instance.
     * @method _triggerSelf
     * @private
     * @param {Mixed} args* Arguments to `trigger`.
     * @chainable
     */
    WebWorker.prototype._triggerSelf = function () {
        var self = this,
            $worker = null;

        $worker = self._$;
        $worker.trigger.apply($worker, arguments);

        return self;
    };

    /**
     * Throw error on the worker instance. This internally triggers the `error` event.
     * Optionally you can also make this method throw an exception.
     * <br />
     * This method also internally updates the `lastError` value on the instance
     * and static properties.
     * @method throwError
     * @param {String} error Error string that describes the error.
     * @param {Mixed} [data] Data that is to be associated with the error event.
     * @param {Boolean} [throwException] Set to `true` if you want to throw an exception in addition to the error event.
     * @chainable
     */
    WebWorker.prototype.throwError = function (error, data, throwException) {
        var self = this;

        error = error || Error.UNKNOWN;
        data = typeof data === 'undefined' ? null : data;
        throwException = throwException || false;

        self._lastError = error;
        WebWorker._lastError = error;

        if ('_triggerError' in self) {
            self._triggerError(error, data, throwException);
        }

        if (throwException) {
            throw new window.Error(error);
        }

        return self;
    };

    /**
     * Internal method used to trigger the `error` event on the instance.
     * @method _triggerError
     * @private
     * @param {String} error Error string that describes the error.
     * @param {Mixed} [data] Data that is to be associated with the error event.
     * @param {Boolean} [throwException] Set to `true` if you want to throw an exception in addition to the error event.
     * @chainable
     */
    WebWorker.prototype._triggerError = function (error, data, throwException) {
        var self = this,
            errorEvent = null;

        errorEvent = new $.Event(Event.ERROR);
        errorEvent.message = self.getLastError();
        errorEvent.errorData = data;
        errorEvent.throwsException = !!throwException;

        self.trigger(errorEvent);
        return self;
    };

    /**
     * Returns the last error that was trigger on this worker instance.
     * @method getLastError
     * @return {String} The last error message that was thrown on this worker instance.
     */
    WebWorker.prototype.getLastError = function () {
        return this._lastError;
    };


    // Static

    /**
     * The last error encountered across all WebWorker instances.
     * @property _lastError
     * @private
     * @static
     * @type {String}
     */
    WebWorker._lastError = null;

    /**
     * List of pre-defined actions for the WebWorker instance.
     *
     *      "START"                 : 'start'
     *      "SET_TERMINATING_STATUS": 'setTerminatingStatus'
     *      "TERMINATE"             : 'terminate'
     *      "TERMINATE_NOW"         : 'terminateNow'
     *      "TRIGGER"               : 'trigger'
     *      "TRIGGER_SELF"          : 'triggerSelf'
     *
     * @property Action
     * @static
     * @type {Object}
     */
    Action = {
        "START": 'start',
        "SET_TERMINATING_STATUS": 'setTerminatingStatus',
        "TERMINATE": 'terminate',
        "TERMINATE_NOW": 'terminateNow',
        "TRIGGER": 'trigger',
        "TRIGGER_SELF": 'triggerSelf'
    };
    WebWorker.Action = Action;

    /**
     * List of pre-defined events for the WebWorker instance.
     *
     *      "INITIALIZED"       : 'webworker:initialized'
     *      "ERROR"             : 'webworker:error'
     *      "WORKER_LOADING"    : 'webworker:worker-loading'
     *      "WORKER_LOADED"     : 'webworker:worker-loaded'
     *      "WORKER_STARTING"   : 'webworker:worker-starting'
     *      "WORKER_STARTED"    : 'webworker:worker-started'
     *      "WORKER_TERMINATING": 'webworker:worker-terminating'
     *      "WORKER_TERMINATED" : 'webworker:worker-terminated'
     *
     * @property Event
     * @static
     * @type {Object}
     */
    Event = {
        "INITIALIZED": 'initialized',
        "ERROR": 'error',

        "WORKER_LOADING": 'worker-loading',
        "WORKER_LOADED": 'worker-loaded',

        "WORKER_STARTING": 'worker-starting',
        "WORKER_STARTED": 'worker-started',

        "WORKER_TERMINATING": 'worker-terminating',
        "WORKER_TERMINATED": 'worker-terminated'
    };
    WebWorker.Event = Event;

    /**
     * Reverse mapping of pre-defined events for faster lookup.
     * @property EventMap
     * @static
     * @type {Object}
     */
    EventMap = {};
    WebWorker.EventMap = EventMap;

    // Add eventPrefix to all event types
    for (key in Event) {
        Event[key] = eventPrefix + Event[key];
        EventMap[Event[key]] = key;
    }

    /**
     * Pre-defined list of errors for the WebWorker instance.
     *
     *      "UNKNOWN"            : "An unknown error occured."
     *      "INVALID_ARGUMENTS"  : "Invalid arguments were supplied to this method."
     *      "WORKER_DID_NOT_LOAD": "Unable to load worker."
     *
     * @property Error
     * @static
     * @type {Object}
     */
    Error = {
        "UNKNOWN": "An unknown error occured.",
        "INVALID_ARGUMENTS": "Invalid arguments were supplied to this method.",
        "WORKER_DID_NOT_LOAD": "Unable to load worker."
    };
    WebWorker.Error = Error;

    WebWorker._workerScriptWrapper = '(function(){var Action=null,Event=null,Listeners=null;Action={{action-data}};Event={{event-data}};self.hasInitialized=false;Listeners={};self.Listeners=Listeners;self.isTerminating=false;' +
                                     'self.terminateHandler=null;self.main=function(){ {{main-function}} };self.init=function(){self.hasInitialized=true;self.trigger(Event.WORKER_LOADED);return self};self.start=function(){if(!self.hasInitialized)return false;self.main.apply(self,arguments);self.trigger(Event.WORKER_STARTED);return self};self.on=function(eventType,listener){eventType+="";listener=listener||null;if(typeof listener!=="function")return self;if(!(eventType in Listeners))Listeners[eventType]=[];Listeners[eventType].push(listener);return self};' +
                                     'self.one=function(eventType,listener){var wrapperListener=null;wrapperListener=function(){listener.apply(this,arguments);self.off(eventType,wrapperListener);return};self.on(eventType,wrapperListener);return};self.off=function(eventType,listener){var key=null;eventType=eventType||null;listener=listener||null;if(eventType===null&&listener===null){for(key in Listeners)delete Listeners[key];return self}for(key in Listeners)self._removeListenerFromEventType(key,listener);return self};self._removeListenerFromEventType=' +
                                     'function(eventType,listener){var listeners=Listeners[eventType];listener=listener||null;if(listener===null){Listeners[eventType]=[];return self}for(var i=0;i<listeners.length;i++)if(listeners[i]===listener){listeners.splice(i,1);i--}return self};self.trigger=function(event,data){var eventType=null,hasData=null;hasData=typeof data!=="undefined";if(typeof event==="string"){eventType=event||null;if(hasData)event={type:eventType,data:data}}else if(typeof event==="object"){eventType=event.type||null;data=' +
                                     'event.data}if(eventType===null)return self;self.sendMessage(Action.TRIGGER,[event]);return self};self.triggerSelf=function(event,data){var worker=this,eventType=null,listeners=null,listenersCount=null,listener=null;if(typeof event==="string")eventType=event||null;else if(typeof event==="object"){eventType=event.type||null;data=event.data}if(eventType===null)return self;event.data=data;listeners=Listeners[eventType]||null;if(listeners===null)return self;listenersCount=listeners.length;for(var i=0;i<' +
                                     'listenersCount;i++){listener=listeners[i];listener.apply(worker,[event])}return self};self.sendMessage=function(action,args){var message=null;action=action||null;args=args||null;if(action===null)return false;message={__isWebWorkerMsg:true};message.action=action;message.args=args;self.postMessage(message);return self};self.terminate=function(){var terminateHandler=null,returnValue=null;terminateHandler=self.terminateHandler||null;if(!self.isTerminating){self.isTerminating=true;self.trigger(Event.WORKER_TERMINATING)}if(typeof terminateHandler===' +
                                     '"function")returnValue=terminateHandler.apply(self,arguments);self.sendMessage(Action.TERMINATE_NOW,[returnValue]);return};self.setTerminatingStatus=function(status){self.isTerminating=status;return self};self.close=self.terminate;self.onmessage=function(event){var originalEvent=event.originalEvent||event,msg=originalEvent.data,action=null,args=null;if(typeof msg==="object"&&"__isWebWorkerMsg"in msg&&msg.__isWebWorkerMsg){action=msg.action;args=msg.args;self[action].apply(self,args);return}return};' +
                                     'self.init();return})();';

    WebWorker._workerScriptWrapper = WebWorker._workerScriptWrapper.replace(/\{\{action-data\}\}/g, JSON.stringify(Action))
                                                                   .replace(/\{\{event-data\}\}/g, JSON.stringify(Event));


    /**
     * Retrieves the last error thrown by any WebWorker instance.
     * @method getLastError
     * @static
     * @return {String} The last error string thrown by any WebWorker instance.
     */
    WebWorker.getLastError = WebWorker.prototype.getLastError;

    /**
     * A jQuery-like method to assign the WebWorker class under a different context and className.
     * You may either provide the context and class name as params
     * OR use the return value to set it
     * OR both.
     * @method noConflict
     * @static
     * @param {Object} context The context to which the WebWorker instance needs to be associated.
     * @param {String} className The class name with which the WebWorker instance will be identified.
     * @return {String} The last error string thrown by any WebWorker instance.
     */
    WebWorker.noConflict = function (context, className) {
        context = context || null;
        className = className || null;

        if (defaultContext[defaultClassName] === WebWorker) {
            delete defaultContext[defaultClassName];
            if (_WebWorker !== null) {
                defaultContext[defaultClassName] = _WebWorker;
            }
        }

        if (context !== null && className !== null) {
            context[className] = WebWorker;
        }

        return WebWorker;
    };

    context[className] = WebWorker;

    return;
})(jQuery);
