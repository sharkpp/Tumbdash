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

		self.selectedTags = [];
		self.comment = '';
		self.liked = false;
		self.cancel = -1;
		self.index = self.cancel;

		setupUI.call(self, options);

		return self;
	};

	K.prototype = PinDialog.prototype;

	var lib = require('lib');

	function setupUI(options) {
		var self = this;

		options = options || {};
		var disableLike = options['disableLike'] || false;

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

		// レイアウト適用モジュールを読み込み
		var UiLayouter = require('UiLayouter');
		var layout;

		self.window = lib.UI.createLightWindow({
				backgroundColor: 'black',
				opacity: 0.7,
			});
		layout = new UiLayouter('PinDialog');

		var view = Ti.UI.createView({ 
				backgroundColor: 'lightgray',
				borderColor: 'white',
			 });

		var buttonArea = Ti.UI.createView({ 
				backgroundColor: 'lightgray',
//				borderColor: 'white',
			 });
		view.add(buttonArea);

		var likeCheck = Ti.UI.createSwitch({
				title: '好き',
				color: 'black',
				style: Titanium.UI.Android.SWITCH_STYLE_CHECKBOX, 
				value: self.liked,
				visible: !disableLike,
			});
		buttonArea.add(likeCheck);

		var commentButton = Ti.UI.createButton({
				title: 'コメント',
			});
		buttonArea.add(commentButton);

		var tagsList = Ti.UI.createWebView({
				url: 'tagview.html',
			});
		view.add(tagsList);

		var okButton = Ti.UI.createButton({
				title: '決定',
			});
		buttonArea.add(okButton);

		var cancelButton = Ti.UI.createButton({
				title: 'キャンセル',
			});
		buttonArea.add(cancelButton);

		self.window.add(view);

		// レイアウトの登録
		
		layout.addItem('view', view);
		layout.addItem('tags-list', tagsList);
		layout.addItem('button-area', buttonArea);
		layout.addItem('like-check', likeCheck);
		layout.addItem('comment-button', commentButton);
		layout.addItem('ok-button', okButton);
		layout.addItem('cancel-button', cancelButton);
		
		// イベントリスナー登録

		commentButton.addEventListener('click', function(){
				var CommentDialog = require('ui/common/CommentDialog');
				var dlg = new CommentDialog({
						title: 'リブログ時のコメントを指定',
						value: self.comment,
					});
				dlg.addEventListener('click', function(e){
						if (e.index != e.source.cancel) {
							self.comment = e.value;
						}
						else {
							self.comment = '';
						}
						// コメントの有無でマークをボタンに付ける
						var title = commentButton.title;
						title = title.replace('✓', '');
						if (self.comment) {
							//マークを付ける
							commentButton.title = '✓' + title;
						}
						else {
							// 元に戻す
							commentButton.title = title;
						}
					});
				dlg.show();
			});
		tagsList.addEventListener('load', function(){
				var tag = '"' + tags.join(',') + '"';
				tagsList.evalJS('updateTags('+tag+');');
			});
		Ti.App.addEventListener("tagclick", function(e){
				var found = false;
				for(var i = 0, tag; tag = self.selectedTags[i]; i++) {
					if (e.value == tag) {
						self.selectedTags.splice(i, 1);
						found = true;
						break;
					}
				}
				if (!found) {
					self.selectedTags.push(e.value);
				}
			});
		okButton.addEventListener('click', function(){
				self.liked = likeCheck.value;
				self.index = 0;
				self.hide();
			});
		cancelButton.addEventListener('click', function(){
				self.selectedTags = [];
				self.comment = '';
				self.liked = false;
				self.index = self.cancel;
				self.hide();
			});
		self.window.addEventListener('close', function(){
				self.fireEvent('click', {
						source: self,
						tags: self.selectedTags,
						comment: self.comment,
						liked: self.liked,
						index: self.index,
					});
			});
	}

	PinDialog.prototype.show = function() {
		var self = this;
		self.window.open();
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
