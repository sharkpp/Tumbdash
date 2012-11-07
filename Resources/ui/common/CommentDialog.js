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

		var isAndroid = Ti.Platform.osname === 'android';
	
		var wndOptions = {
				backgroundColor: 'black',
				opacity: 0.7,
			};
		if (isAndroid) {
			wndOptions['navBarHidden'] = true;
		}
	
		self.window = Ti.UI.createWindow(wndOptions);

		var view = Ti.UI.createView({ 
				backgroundColor: 'lightgray',
				borderColor: 'white',
width: '240dp',
height: '200dp',
			 });

		var titleLabel = Ti.UI.createLabel({ 
				backgroundColor: 'gray',
				color: 'white',
width: '100%',
height: '40dp',
top: '0dp',
				text: self._title,
//				textAlign: Ti.UI.a
			 });
		view.add(titleLabel);

//		var textArea = Ti.UI.createTextField({
//width: '80%',
//top: '0dp',
//				title: '決定',
//			});
//		view.add(textArea);

		var textBox = Ti.UI.createTextField({
width: '80%',
			});
		view.add(textBox);

		var okButton = Ti.UI.createButton({
width: '50%',
left: '0%',
bottom: '0dp',
				title: '決定',
			});
		view.add(okButton);

		var cancelButton = Ti.UI.createButton({
width: '50%',
left: '50%',
bottom: '0dp',
				title: 'キャンセル',
			});
		view.add(cancelButton);

		self.window.add(view);

		self.window.addEventListener('close', function(){
				self.fireEvent('click', {
						source: self,
						index: self.index,
						value: self.value,
					});
			});
		okButton.addEventListener('click', function(){
				self.value = textBox.value;
				self.index = 0;
				self.hide();
			});
		cancelButton.addEventListener('click', function(){
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

	CommentDialog.prototype.show = function(options) {
		var self = this;
		options = options || {};
		if (options['containingTab']) {
			options['containingTab'].open(self.window, { animation: false });
		}
		else {
			self.window.open({modal: true});
		}
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
