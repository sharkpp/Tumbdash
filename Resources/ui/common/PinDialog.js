//PinDialog Component Constructor

module.exports = (function(global){
	var K = function(){};

	var PinDialog = function(options) {
		var self;

		if (this instanceof PinDialog) {
			self = this;
		} else {
			self = new K();
		}

		setupUI.call(self, options);

		return self;
	};

	K.prototype = PinDialog.prototype;

	function setupUI(options) {
		var self = this;

		options = options || {};

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
left: '20dp',
top: '20dp',
right: '20dp',
bottom: '20dp',
			 });

		var likeCheck = Ti.UI.createSwitch({
left: '0dp',
top: '0dp',
				title: '♡',
				style: Titanium.UI.Android.SWITCH_STYLE_CHECKBOX, 
			});
		view.add(likeCheck);

		var commentButton = Ti.UI.createButton({
left: '0dp',
top: '40dp',
				title: 'コメント',
			});
		commentButton.addEventListener('click', function(){
				var CommentDialog = require('ui/common/CommentDialog');
				var dlg = new CommentDialog({
						title: 'リブログ時のコメントを指定',
					});
				dlg.show({ containingTab: self.containingTab });
			});
		view.add(commentButton);

		self.window.add(view);
	}

	PinDialog.prototype.show = function(options) {
		var self = this;
		options = options || {};
		var containingTab = options['containingTab'] || undefined;
		if (containingTab) {
			self.containingTab = containingTab;
			containingTab.open(self.window, { animation: false });
		}
		else {
			self.window.open({modal: true});
		}
	}

	PinDialog.prototype.hide = function() {
		var self = this;
		self.window.close();
	}

	// イベントリスナーの登録
	PinDialog.prototype.addEventListener = function(eventName, callback) {
		this.listeners = this.listeners || {};
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(callback);
	};

	// イベントの発火
	PinDialog.prototype.fireEvent = function(eventName, data) {
		var eventListeners = this.listeners[eventName] || [];
		for (var i = 0; i < eventListeners.length; i++) {
			eventListeners[i].call(this, data);
		}
	};

	return PinDialog;
})(this);
