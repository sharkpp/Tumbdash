//JumpDialog Component Constructor

var exports = exports || this;
exports.JumpDialog = (function(global){
	var K = function(){};

	var JumpDialog = function(options) {
		var self;

		if (this instanceof JumpDialog) {
			self = this;
		} else {
			self = new K();
		}

		setupUI.call(self, options);

		return self;
	};

	K.prototype = JumpDialog.prototype;

	function setupUI(options) {
		var self = this;

		options = options || {};
		var cached = options['cached'] || [];
		var id     = options['id'] || 0;

		var position = -1;
		for (var i = 0, num = cached.length; i < num; i++) {
			if (id == cached[i]) {
				position = i;
			}
		}

		self.id = 0;

		// レイアウト適用モジュールを読み込み
		var UiLayouter = require('UiLayouter');
		var layout;

		var isAndroid = Ti.Platform.osname === 'android';
	
		var wndOptions = {
				backgroundColor: 'black',
				opacity: 0.7,
			};
		if (isAndroid) {
			wndOptions['navBarHidden'] = true;
		}
	
		self.window = Ti.UI.createWindow(wndOptions);
		layout = new UiLayouter('JumpDialog');

		var view = Ti.UI.createView({ 
				backgroundColor: 'lightgray',
				borderColor: 'white',
			 });

		var postSliderArea = Ti.UI.createView({
				backgroundColor: 'gray',
			});
		var postSliderBase = Ti.UI.createView({
				backgroundColor: 'gray',
			});
		var postSlider = Ti.UI.createSlider({
				min: 0,
				max: cached.length,
				value: position,
			});
	//	var postIndex = Ti.UI.createTextField({
	//				valu: '0',
	//				textAlign: Ti.UI.TEXT_ALIGNMENT_RIGHT,
	//				keyboardType: Ti.UI.KEYBOARD_DECIMAL_PAD,
	//		});
		var postIndex = Ti.UI.createLabel({
					text: '0',
					textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
			});

		var buttonArea = Ti.UI.createView({
				backgroundColor: 'lightgray',
			});
		var cancelButton = Ti.UI.createButton({ title: 'キャンセル' });
		var jumpButton = Ti.UI.createButton({ title: '移動' });
		var jumpTopButton = Ti.UI.createButton({ title: '先頭に移動' });
		var jumpBottomButton = Ti.UI.createButton({ title: '末尾に移動' });

		layout.addItem('view', view);
		layout.addItem('post-slider-area', postSliderArea);
		layout.addItem('post-slider-base', postSliderBase);
		layout.addItem('post-index', postIndex);
		layout.addItem('post-slider', postSlider);
		layout.addItem('button-area', buttonArea);
		layout.addItem('cancel', cancelButton);
		layout.addItem('jump', jumpButton);
		layout.addItem('jump-top', jumpTopButton);
		layout.addItem('jump-bottom', jumpBottomButton);
	
		postSliderArea.add(postIndex);
		postSliderBase.add(postSlider);
		postSliderArea.add(postSliderBase);
		view.add(postSliderArea);
		buttonArea.add(cancelButton);
		buttonArea.add(jumpButton);
		buttonArea.add(jumpTopButton);
		buttonArea.add(jumpBottomButton);
		view.add(buttonArea);

		postSlider.addEventListener('change', function(e){
				var value = '' + Math.round(e.value + 1) + '/' + postSlider.max;
				if (value != postIndex.value) {
				//	setTimeout(function(){ postIndex.value = value; }, 100);
					setTimeout(function(){ postIndex.text = value; }, 100);
				}
			});
//		postIndex.addEventListener('change', function(e){
//				var value = parseInt(e.value);
//				if (value != Math.round(postSlider.value + 1)) {
////					setTimeout(function(){ postSlider.value = value; }, 100);
//				}
//			});
		cancelButton.addEventListener('click', function(){
				self.id = 0;
				self.hide();
			});
		jumpButton.addEventListener('click', function(){
				var pos = Math.round(postSlider.value);
				self.id = 0 <= pos && pos < cached.length ? cached[pos] : 0;
				self.hide();
			});
		jumpTopButton.addEventListener('click', function(){
				self.id = 0 < cached.length ? cached[0] : 0;
				self.hide();
			});
		jumpBottomButton.addEventListener('click', function(){
				self.id = 0 < cached.length ? cached[cached.length - 1] : 0;
				self.hide();
			});
		self.window.addEventListener('close', function(){
				self.fireEvent('click', { id: self.id });
			});

		self.window.add(view);

		postSlider.fireEvent('change', { value: postSlider.value });
	}

	JumpDialog.prototype.show = function(options) {
		var self = this;
		options = options || {};
		if (options['containingTab']) {
			options['containingTab'].open(self.window, { animation: false });
		}
		else {
			self.window.open({modal: true});
		}
	}

	JumpDialog.prototype.hide = function() {
		var self = this;
		self.window.close();
	}

	// イベントリスナーの登録
	JumpDialog.prototype.addEventListener = function(eventName, callback) {
		this.listeners = this.listeners || {};
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(callback);
	};

	// イベントの発火
	JumpDialog.prototype.fireEvent = function(eventName, data) {
		var eventListeners = this.listeners[eventName] || [];
		for (var i = 0; i < eventListeners.length; i++) {
			eventListeners[i].call(this, data);
		}
	};

	return JumpDialog;
})(this);
