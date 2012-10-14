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

		//determine platform and form factor and render approproate components
		var osname  = Ti.Platform.osname,
			version = Ti.Platform.version,
			height  = Ti.Platform.displayCaps.platformHeight,
			width   = Ti.Platform.displayCaps.platformWidth;
	
		//considering tablet to have one dimension over 900px - this is imperfect, so you should feel free to decide
		//yourself what you consider a tablet form factor for android
		var isAndroid = osname === 'android';
		var isTablet  = osname === 'ipad' || (isAndroid && (width > 899 || height > 899));
	
		var wndOptions = {
				backgroundColor: 'black',
				opacity: 0.7,
			};
		if (isAndroid) {
			wndOptions['navBarHidden'] = true;
		}
	
		self.window = Ti.UI.createWindow(wndOptions);
	
		var view = Ti.UI.createView({ 
				backgroundColor: '#fff',
				borderRadius: 10,
				borderWidth: 3,
				width: '80%',
				height: '40%',
			 });

		var postSliderArea = Ti.UI.createView({
				backgroundColor: 'gray',
				left: '0%',
				top: '0%',
				width: '100%',
				height: '49%',
			});
		var postSliderBase = Ti.UI.createView({
				backgroundColor: 'gray',
				left: '0%',
				top: '0%',
				width: '100%',
				height: '50%',
			});
		var postSlider = Ti.UI.createSlider({
				left: '10dp',
				right: '10dp',
				height: '28dp',
				min: 0,
				max: cached.length,
				value: position,
			});
	//	var postIndex = Ti.UI.createTextField({
	//				top: '51%',
	//				width: '100dp',
	//				height: '48%',
	//				valu: '0',
	//				textAlign: Ti.UI.TEXT_ALIGNMENT_RIGHT,
	//				keyboardType: Ti.UI.KEYBOARD_DECIMAL_PAD,
	//		});
		var postIndex = Ti.UI.createLabel({
					top: '51%',
					width: '100dp',
					height: '48%',
					text: '0',
					textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER,
			});
		var cancelButton = Ti.UI.createButton({
				title: 'キャンセル',
				left: '0%',
				top: '75%',
				width: '100%',
				height: '25%',
			});
		var jumpButton = Ti.UI.createButton({
				title: '移動',
				left: '35%',
				top: '50%',
				width: '30%',
				height: '25%',
			});
		var jumpTopButton = Ti.UI.createButton({
				title: '先頭に移動',
				left: '0%',
				top: '50%',
				width: '35%',
				height: '25%',
			});
		var jumpBottomButton = Ti.UI.createButton({
				title: '末尾に移動',
				left: '65%',
				top: '50%',
				width: '35%',
				height: '25%',
			});
	
		postSliderArea.add(postIndex);
		postSliderBase.add(postSlider);
		postSliderArea.add(postSliderBase);
		view.add(postSliderArea);
		view.add(cancelButton);
		view.add(jumpButton);
		view.add(jumpTopButton);
		view.add(jumpBottomButton);

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
