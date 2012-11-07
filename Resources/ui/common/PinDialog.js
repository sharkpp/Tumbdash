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

		var tagsForReblog = Ti.App.Properties.getString('tagsForReblog', '');
		tagsForReblog = tagsForReblog.split(/[\n\r]/);
		for(var i = tagsForReblog.length - 1; 0 <= i; i--) {
			if (!tagsForReblog[i].length) {
				tagsForReblog.splice(i, 1);
			}
		}
		var tags_ = {};
		var maxCount = 0;
		for(var i = tagsForReblog.length - 1; 0 <= i; i--) {
			tagsForReblog[i] = tagsForReblog[i].split(',');
			for(var j = 0, tag; tag = tagsForReblog[i][j]; j++) {
				tags_[tag] = tags_[tag] || 0;
				tags_[tag]++;
				maxCount = maxCount < tags_[tag] ? tags_[tag] : maxCount;
			}
		}
		var tags = [];
		for(var i = maxCount; 0 < i; i--) {
			for(tag in tags_) {
				if (i == tags_[tag]) {
					tags[tags.length] = tag;
				}
			}
		}

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
				dlg.addEventListener('click', function(e){
						if (e.index != e.source.cancel) {
							alert(e.value);
						}
					});
				dlg.show({ containingTab: self.containingTab });
			});
		view.add(commentButton);

		var tagBox = Ti.UI.createWebView({
				top: '60dp',
				width: '90%',
				bottom: '40dp',
				url: 'tagview.html',
//				url: Ti.Filesystem.resourcesDirectory + '/etc/about.html',
			});
		view.add(tagBox);

		tagBox.addEventListener('load', function(){
				var tag = tags.length ? '["' + tags.join('","') + '"]' : '[]';
				tagBox.evalJS('updateTags('+tag+');');
			});
		Ti.App.addEventListener("onTagClicked", function(e){
				tagBox.evalJS('toggleTags(["'+e.value+'"]);');
			});

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
