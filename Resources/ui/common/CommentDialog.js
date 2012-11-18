//CommentDialog Component Constructor

module.exports = (function(global){
	var K = function(){};

	var CommentDialog = function(options) {
		var self;

		if (this instanceof CommentDialog) {
			self = this;
		} else {
			self = new K();
		}

		setupUI.call(self, options);

		return self;
	};

	K.prototype = CommentDialog.prototype;

	var lib = require('lib');

	function setupUI(options) {
		var self = this;

		options = options || {};

		self._title  = options['title']  || '';
		self._width  = options['width']  || '';
		self._height = options['height'] || '';
		self._left   = options['left']   || '';
		self._top    = options['top']    || '';
		self._right  = options['right']  || '';
		self._bottom = options['bottom'] || '';
		self.cancel  = options['cancel'] || -1;
		self.value   = options['value'] || '';

		var isAndroid = Ti.Platform.osname === 'android';

		self.window = lib.UI.createLightWindow({
				backgroundColor: 'black',
				opacity: 0.7,
			});
		var layout = lib.UI.createLayouter('CommentDialog');

		var view = Ti.UI.createView({ 
				backgroundColor: 'lightgray',
				borderColor: 'white',
			 });

		var titleLabel = Ti.UI.createLabel({ 
				backgroundColor: 'gray',
				color: 'white',
				text: self._title,
				textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER
			 });

		var textBox = Ti.UI.createTextArea({
				value: self.value,
				softKeyboardOnFocus: Ti.UI.Android.SOFT_KEYBOARD_SHOW_ON_FOCUS
			});

		var okButton = Ti.UI.createButton({ title: '決定' });
		var cancelButton = Ti.UI.createButton({ title: 'キャンセル' });

		layout.addItem('view', view);
		layout.addItem('view-title', titleLabel);
		layout.addItem('text', textBox);
		layout.addItem('cancel-button', cancelButton);
		layout.addItem('ok-button', okButton);

		view.add(titleLabel);
		view.add(textBox);
		view.add(okButton);
		view.add(cancelButton);
		self.window.add(view);

		self.window.addEventListener('focus', function(){
				textBox.focus();
			});
		self.window.addEventListener('close', function(){
				textBox.blur();
				self.fireEvent('click', {
						source: self,
						index: self.index,
						value: self.value,
					});
			});
		okButton.addEventListener('click', function(){
				textBox.blur();
				self.value = textBox.value;
				self.index = 0;
				self.hide();
			});
		cancelButton.addEventListener('click', function(){
				textBox.blur();
				self.value = '';
				self.index = self.cancel;
				self.hide();
			});

		updateProperty.call(self);
	}

	function updateProperty() {
		var self = this;
	}

	CommentDialog.prototype.__defineSetter__("title", function(x) {
		var self = this;
		self._title = x;
		updateProperty.call(self);
	});

	CommentDialog.prototype.__defineSetter__("width", function(x) {
		var self = this;
		self._width = x;
		updateProperty.call(self);
	});

	CommentDialog.prototype.__defineSetter__("height", function(x) {
		var self = this;
		self._height = x;
		updateProperty.call(self);
	});

	CommentDialog.prototype.__defineSetter__("left", function(x) {
		var self = this;
		self._left = x;
		updateProperty.call(self);
	});

	CommentDialog.prototype.__defineSetter__("top", function(x) {
		var self = this;
		self._top = x;
		updateProperty.call(self);
	});

	CommentDialog.prototype.__defineSetter__("right", function(x) {
		var self = this;
		self._right = x;
		updateProperty.call(self);
	});

	CommentDialog.prototype.__defineSetter__("bottom", function(x) {
		var self = this;
		self._bottom = x;
	});

	CommentDialog.prototype.show = function() {
		var self = this;
		self.window.open();
	}

	CommentDialog.prototype.hide = function() {
		var self = this;
		self.window.close();
	}

	// イベントリスナーの登録
	CommentDialog.prototype.addEventListener = function(eventName, callback) {
		this.listeners = this.listeners || {};
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(callback);
	};

	// イベントの発火
	CommentDialog.prototype.fireEvent = function(eventName, data) {
		var eventListeners = this.listeners[eventName] || [];
		for (var i = 0; i < eventListeners.length; i++) {
			eventListeners[i].call(this, data);
		}
	};

	return CommentDialog;
})(this);
