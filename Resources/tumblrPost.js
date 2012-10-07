// Tumblr Post Component Constructor

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// "

var exports = exports || this;
exports.tumblrPost = (function(global){
	var K = function(){};

	var tumblrPost = function(logger) {
		var self;

		if (this instanceof tumblrPost) {
			self = this;
		} else {
			self = new K();
		}

		self.log = logger;

		self.baseDir_ = ''; // 基準ディレクトリが変化したか？のチェック用
		self.updateProperties();
		//Ti.Platform.displayCaps.platformWidth

		return self;
	};

	K.prototype = tumblrPost.prototype;

	// テンプレートを読み込み
	function loadTemplate() {
		var self = this;
		var postTemplates = {
				'@':        'template.html',
				'text':     'text.html',
				'quote':    'quote.html',
				'link':     'link.html',
				'answer':   'answer.html',
				'video':    'video.html',
				'audio':    'audio.html',
				'photo':    'photo.html',
				'photoset': 'photoset.html',
				'chat':     'chat.html'
			};
		self.template = {};
		for (name in postTemplates) {
			var path = self.templateDir + '/' + postTemplates[name];
			var file = Ti.Filesystem.getFile(path);
			var data = file.read();
			if (!data || !data.length) {
				// アプリケーションデータから読めなかった場合、
				// リソースディレクトリから初期データを読み込み
				var path2 = Ti.Filesystem.resourcesDirectory + 'etc/template/' + postTemplates[name];
				var file2 = Ti.Filesystem.getFile(path2);
				data = file2.read();
				if (data && data.length) {
					file.write(data);
				}
				else {
					data = '';
				}
			}
			self.template[name] = data.toString();
		}
	}

	// テンプレートを適用
	function applyTemplate(template, data) {
		var self = this;
		var result = template;
		// ポストを置換
		for (key in data) {
			result = result.split('{'+key+'}').join(data[key])
			               .split('{'+key+':escape}').join(escape(data[key]));
		}
		// 設定を置換
	    result = result.replace(/{([a-zA-Z_]+):pref}/g, function(ma, key) {
							return "undefined" != typeof self.pref[key] ? self.pref[key] : '';
						});
		// 置換できていないものをクリア
		result = result.replace(/{[a-zA-Z:_]+}/g, '');
		return result;
	}

	// 'text'を描画
	function renderTextPost(post) {
		return applyTemplate.call(this, this.template['text'], post);
	}

	// 'photos'を描画
	function renderPhotoPost(post) {
		var self = this;
		var photoset = '';
		var photos = post['photos'];
		for (var i = 0, photo; photo = photos[i]; i++) {
			var disp_photo = { url: '', width: 0 };
			if (self.photoSize < 0 && photo['original_size']) {
				disp_photo = photo['original_size'];
			}
			else {
				// 指定サイズを超えない最大の画像を選ぶ
				var alt_sizes = photo['alt_sizes'];
				for (var j = 0, alt_size; alt_size = alt_sizes[j]; j++) {
					if (alt_size['width'] <= self.photoSize &&
						disp_photo['width'] < alt_size['width']) {
						disp_photo = alt_size;
					}
				}
			}
			if ('' != disp_photo['url']) {
				photoset += applyTemplate.call(self, self.template['photoset'], disp_photo);
			}
		}
		var data = {};
		for (key in post) {
			data[key] = post[key];
		}
		data['photos'] = photoset;
		return applyTemplate.call(this, this.template['photo'], data);
	}

	// 'quote'を描画
	function renderQuotePost(post) {
		return applyTemplate.call(this, this.template['quote'], post);
	}

	// 'link'を描画
	function renderLinkPost(post) {
		return applyTemplate.call(this, this.template['link'], post);
	}

	// 'video'を描画
	function renderVideoPost(post) {
		var self = this;
		var players = post['player'];
		var embed_code = '';
		for (var i = 0, player; player = players[i]; i++) {
			embed_code = player['embed_code'];
		}
		var data = {};
		for (key in post) {
			data[key] = post[key];
		}
		data['embed_code'] = embed_code;
		return applyTemplate.call(self, self.template['video'], data);
	}

	// 'audio'を描画
	function renderAudioPost(post) {
		var self = this;
		var data = {};
		for (key in post) {
			data[key] = post[key];
		}
		if (!self.showAudioAlbumArt) { // アルバムアートを表示
			delete data['album_art'];
		}
		return applyTemplate.call(this, this.template['audio'], data);
	}

	// 'chat'を描画
	function renderChatPost(post) {
		return applyTemplate.call(this, this.template['chat'], post);
	}

	// 'answer'を描画
	function renderAnswerPost(post) {
		return applyTemplate.call(this, this.template['answer'], post);
	}

	// POSTを描画
	tumblrPost.prototype.renderPost = function(post) {
		var self = this;
		var postData = '';

		if (self.debugMode) {
			loadTemplate.call(self);
		}

		// POSTの種別ごとに内容を生成
		switch (post['type']) {
		case 'text':   postData = renderTextPost.call(self,   post); break;
		case 'quote':  postData = renderQuotePost.call(self,  post); break;
		case 'link':   postData = renderLinkPost.call(self,   post); break;
		case 'answer': postData = renderAnswerPost.call(self, post); break;
		case 'video':  postData = renderVideoPost.call(self,  post); break;
		case 'audio':  postData = renderAudioPost.call(self,  post); break;
		case 'photo':  postData = renderPhotoPost.call(self,  post); break;
		case 'chat':   postData = renderChatPost.call(self,   post); break;
		}

		if (self.debugMode) {
			postData += '<hr>' + htmlEntities(JSON.stringify(post));
		}

		// テンプレートに流し込む
		return applyTemplate.call(self, self.template['@'], {
		                              'blog_name': post['blog_name'],
		                              'post_type': post['type'],
		                              'post_data': postData,
		                          });
	}

	tumblrPost.prototype.updateProperties = function() {
		var self = this;
		// デバッグモード
		self.debugMode = Ti.App.Properties.getBool('debugMode', false)
		// 映像の自動表示
		self.autoLoadVideo = Ti.App.Properties.getBool('autoLoadVideo', false);
		// 音楽の自動表示
		self.autoLoadAudio = Ti.App.Properties.getBool('autoLoadAudio', false);
		// アルバムアートを表示"
		self.showAudioAlbumArt = Ti.App.Properties.getBool('showAudioAlbumArt', true);
		// 複数枚の画像を自動表示
		self.autoLoadPhotoset = Ti.App.Properties.getBool('autoLoadPhotoset', true);
		// 画像サイズ
		self.photoSize = Ti.App.Properties.getInt('photoSize', 400);
		// 基準ディレクトリ
		self.baseDir = Ti.App.Properties.getString('baseDir', '');
		self.baseDir = 'file://' + self.baseDir.replace(/^file:\/\//, '');
		//
		self.pref = {
				autoLoadVideo:    self.autoLoadVideo    ? 'true' : 'false',
				autoLoadAudio:    self.autoLoadAudio    ? 'true' : 'false',
				autoLoadPhotoset: self.autoLoadPhotoset ? 'true' : 'false',
			};
		// テンプレートディレクトリ
		self.templateDir = self.baseDir + '/template';
		var templateDir = Ti.Filesystem.getFile(self.templateDir);
		if (!templateDir.exists()) {
			templateDir.createDirectory();
		}
		if (self.baseDir != self.baseDir_) {
			loadTemplate.call(self);
			self.baseDir_ = self.baseDir;	
		}
	}

	return tumblrPost;
})(this);
