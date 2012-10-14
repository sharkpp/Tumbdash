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
		var total = options['total'] || 0;
		var pos   = options['pos'] || 0;

		self.total    = total;
		self.position = pos;
		
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
				backgroundColor: '#A000',
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

		var postSliderBase = Ti.UI.createView({
				backgroundColor: 'gray',
				left: '0%',
				top: '0%',
				width: '100%',
				height: '49%',
			});
		var postSlider = Ti.UI.createSlider({
				left: '10dp',
				right: '10dp',
				top: '5%',
				height: '40%',
				min: 0,
				max: total,
				value: pos,
			});
		var postIndex = Ti.UI.createTextField({
					top: '51%',
					width: '100dp',
					height: '48%',
					valu: '0',
					textAlign: Ti.UI.TEXT_ALIGNMENT_RIGHT,
					keyboardType: Ti.UI.KEYBOARD_DECIMAL_PAD,
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
	
		postSliderBase.add(postIndex);
		postSliderBase.add(postSlider);
		view.add(postSliderBase);
		view.add(cancelButton);
		view.add(jumpButton);
		view.add(jumpTopButton);
		view.add(jumpBottomButton);
	
		postSlider.addEventListener('change', function(e){
//Ti.API.trace('postSlider,change '+postSlider.value+','+postIndex.value+','+e.value);
				var value = '' + Math.round(e.value + 1);
				if (value != postIndex.value) {
					setTimeout(function(){ postIndex.value = value; }, 100);
				}
			});
		postIndex.addEventListener('change', function(e){
//Ti.API.trace('postIndex,change '+postSlider.value+','+postIndex.value+','+e.value);
				var value = parseInt(e.value);
				if (value != Math.round(postSlider.value + 1)) {
//					setTimeout(function(){ postSlider.value = value; }, 100);
				}
			});
		cancelButton.addEventListener('click', function(){
				self.position = -1;
				self.hide();
			});
		jumpButton.addEventListener('click', function(){
				self.position = Math.round(postSlider.value);
				self.hide();
			});
		jumpTopButton.addEventListener('click', function(){
				self.position = 0;
				self.hide();
			});
		jumpBottomButton.addEventListener('click', function(){
				self.position = self.total - 1;
				self.hide();
			});
		self.window.addEventListener('close', function(){
				self.fireEvent('click', { position: self.position });
			});

		self.window.add(view);
	}

	JumpDialog.prototype.show = function() {
		var self = this;
		self.window.open({modal: true});
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
