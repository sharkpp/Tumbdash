// Tumblr Dashboard Component Constructor

function notify(msg) {
	if('android'==Ti.Platform.osname)Ti.UI.createNotification({message:msg}).show();
	else                             alert(msg);
}

var exports = exports || this;
exports.Dashboard = (function(global){
	var K = function(){};

	var Dashboard = function(tumblr, logger) {
		var self;

		if (this instanceof Dashboard) {
			self = this;
		} else {
			self = new K();
		}

		tumblr.addEventListener('login', function(e) {
				if (e.success) {
self.log.debug('login suceess');
//self.log.debug('tumblrAccessTokenKey=' + e.accessTokenKey);
//self.log.debug('tumblrAccessTokenSecret=' + e.accessTokenSecret);
					Ti.App.Properties.setString('tumblrAccessTokenKey',    e.accessTokenKey);
					Ti.App.Properties.setString('tumblrAccessTokenSecret', e.accessTokenSecret);
					//
					setTimeout(function(){ self.fireEvent('login', {success:true}); }, 1);
					//
					var beginRead = false;
					if (self.cacheList.length && self.blog['name']) {
						beginRead = true;
						beginReadPosts.call(self);
					}
					//
					self.state = self.STATE_REQUEST_USER_INFO;
					//
					tumblr.request(self.apiBaseUrl + 'v2/user/info', {}, {}, 'POST', function(e) {
							if (e.success && e.result.text) {
								// 受信データ解析
								var json = JSON.parse(e.result.text || '{}');
								var blogs = json['response']['user']['blogs']
								updateBlogsInfo.call(self, blogs);
								Ti.App.Properties.setString('blogsInfo', JSON.stringify(blogs));
								//
								self.state = self.STATE_IDLE;
								// POST取得開始
								if (!beginRead) {
									beginReadPosts.call(self);
								}
							}
							else {
							}
						});
				}
				else {
					//
					setTimeout(function(){ self.fireEvent('login', {success:false}); }, 1);
				}
			});

		self.state = 0; // STATE_INITIAL

		self.blog  = {};
		self.blogs = [];
		self.listeners = {};
		self.tumblr = tumblr;
		self.log = logger;
		self.pinBuffer  = []; // PINバッファ
		self.cacheData  = {}; // post id : 投稿内容
		self.cacheList  = []; // 順序 : post id のリスト
		self.cacheIndex = 0;  // cacheListの参照位置

		self.requestQue = []; // 
		self.requesting = false;

		self.commandQueue = []; // 

		self.reblogQueue = [];

		self.sweepPosts = [];

		self.postRetryNum = 5;
		self.postTimeout = 1000;
		self.updateProperties();

		var blogs = JSON.parse(Ti.App.Properties.getString('blogsInfo', '') || '{}');
		updateBlogsInfo.call(self, blogs);

	//	self.loadCache();

		return self;
	};

	K.prototype = Dashboard.prototype;

	// Return codes
	Dashboard.prototype.STATUS_OK      = 200; // 200: OK
	Dashboard.prototype.STATUS_CREATED = 201; // 201: Created

	Dashboard.prototype.STATE_INITIAL           = 0; // 初期状態
	Dashboard.prototype.STATE_WAIT_LOGIN        = 1; // ログイン待ち
	Dashboard.prototype.STATE_REQUEST_USER_INFO = 2; // ユーザー情報取得中
	Dashboard.prototype.STATE_REQUEST_DASHBOARD = 3; // ダッシュボード取得中
	Dashboard.prototype.STATE_IDLE              = 4; // 待機

	Dashboard.prototype.CMD_PREV_POST       = 0; // 前のPOSTを取得
	Dashboard.prototype.CMD_NEXT_POST       = 1; // 次のPOSTを取得
	Dashboard.prototype.CMD_READ_POST       = 2; // 
	Dashboard.prototype.CMD_REQ_FUTURE_POST = 3; // 

	function updateBlogsInfo(blogs) {
		var self   = this;
		self.blog  = {};
		self.blogs = [];
		if (!blogs) {
			return;
		}
		for (var i = 0, blog; blog = blogs[i]; i++) {
			blog['hostname'] = String(blog['url']).replace(/^https?:\/\/([^\/]+?)\/.*$/, '$1')
			self.blogs.push(blog);
			if (blog['primary']) {
				self.blog = blog;
			}
		}
	}

	function beginReadPosts() {
		/*
		 *	キャッシュがなければ260件分(APIの制限)読み込む ... 初回読み取り
		 *	キャッシュがあった場合は先頭のIDをsince_idとして指定し順に取得 ... 次回以降の読み取り
		 *	過去方向への移動で最後まで来た場合は、一回のみダッシュボードをoffset=0で読み込み、キャッシュしている以降もデータがあるか判断
		 *	未来方向への移動の場合はIDをsince_idとして指定し取得
		 */

		var self   = this;
		var tumblr = this.tumblr;

		if (!self.cacheList.length) {
			// キャッシュ無し
			for (var i = 0; i < 260; i += 20) {
				self.requestQue.push({ offset: i, limit: 20 });
			}
		}
		else {
			// キャッシュあり
			self.requestQue.push({ since_id: ''+self.cacheList[0], limit: 20 });
			requestCachedPosts.call(self, self.currentId());
		}

		requestDashboard.call(self);

		fetchCommand.call(self, {
					type: self.CMD_SWEEP_POST
				});
	}

	function isEmptyCachedPost(id) {
		var self = this;
		return self.cacheData[id] && !self.cacheData[id]['post_url'];
	}

	function requestCachedPosts(targetId) {
		var self   = this;
		var file, data;

		var requestIdList = [];

		if (targetId && isEmptyCachedPost.call(self, targetId)) {
			// 要求IDが指定された場合は優先的に処理する
			requestIdList.push(targetId);
		}

		var validIndex = self.cacheIndex < self.cacheList.length; // キャッシュを示すインデックスが有効か？
		var currentId  = validIndex ? self.cacheList[self.cacheIndex] : 0; // 現在選択中のID
		if (0 != currentId) {
			var cacheRange = 20;
			var cacheOutLeft  = self.cacheIndex - Math.round(cacheRange / 2)
			var cacheOutRight = self.cacheIndex + (cacheRange - Math.round(cacheRange / 2));
			for (var i = 0, num = self.cacheList.length; i < num; i++) {
				var id   = self.cacheList[i];
				var post = self.cacheData[id];
				if (i < cacheOutLeft || cacheOutRight < i) {
					self.cacheData[id] = {
							id: id,
							reblog_key: post['reblog_key'],
							timestamp: post['timestamp'],
						};
				}
				else if(isEmptyCachedPost.call(self, id)) {
					requestIdList.push(id);
					if (10 <= requestIdList.length) {
						break;
					}
				}
			}
		}
		else {
			// キャッシュとしてインデックスのみのポストを探す
			for (id in self.cacheData) {
				if (isEmptyCachedPost.call(self, id)) {
					requestIdList.push(id);
					if (10 <= requestIdList.length) {
						break;
					}
				}
			}
		}

		if (!requestIdList.length) {
			return;
		}

		for (var i = 0, requestId; requestId = requestIdList[i]; i++) {
			// ファイルから読み込み
			var post = readCache.call(self, requestId);
			if (post) {
				var id = post['id'];
				self.cacheData[id] = post;
				if (currentId == id) {
					// 通知
					setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 10);
				}
			}
		}

		setTimeout(function(){ requestCachedPosts.call(self); }, 10);
	}

	function requestDashboard() {
		var self   = this;
		var tumblr = this.tumblr;

		if (!self.requestQue.length ||
			self.requesting)
		{
			setTimeout(function(){ fetchCommand.call(self); }, 10);
			return;
		}

		self.state      = self.STATE_REQUEST_DASHBOARD;
		self.requesting = true;

		var options = self.requestQue[0];

		tumblr.request(self.apiBaseUrl + 'v2/user/dashboard', options, {}, 'POST', function(e) {
				self.state      = self.STATE_IDLE;
				self.requesting = false;
				if (e.success && e.result.text) {
					// キューを消費
					self.requestQue.shift();
					// 受信データ解析
					var json  = JSON.parse(e.result.text);
					var posts = json['response']['posts']; // POST
					var validIndex = self.cacheIndex < self.cacheList.length; // キャッシュを示すインデックスが有効か？
					var currentId = validIndex ? self.cacheList[self.cacheIndex] : 0; // 現在選択中のID
					var isEmptyCachedPost_ = 1 == posts.length && isEmptyCachedPost.call(self, posts[0]['id']);
					// POSTを追加
					var readCount = 0;
					for (var i = 0, post; post = posts[i]; i++) {
						var postId = post['id'];
						var existPost = undefined != self.cacheData[postId];
						self.cacheData[postId] = post;
self.log.debug('recv post #'+postId+' '+(existPost?'(already exist)':''));
						if (!existPost) {
							self.cacheList.push(postId);
							readCount++;
						}
						// ファイルの保存
						var file = Ti.Filesystem.getFile(String.format("%s/%s.json", self.cacheDir, ''+postId));
						file.write(JSON.stringify(post));
					}
					self.cacheList.sort(function(a,b){
							if (a != b) {
								return a < b ? 1 : -1;
							}
							return 0;
						});
					// 現在表示中のものが更新されたら通知
					if (!validIndex || 0 != currentId) {
						// 現在位置がずれていたら移動
						if (validIndex && currentId != self.cacheList[self.cacheIndex]) {
							for (var i = 0, num = self.cacheList.length; i < num; i++) {
								if (currentId == self.cacheList[i]) {
									self.cacheIndex = i;
									break;
								}
							}
						}
						// 通知
						if (isEmptyCachedPost.call(self, currentId)) {
							setTimeout(function(){ self.fireEvent('loading', currentId); }, 1);
							requestCachedPosts.call(self, currentId);
						}
						else {
							setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
						}
					}
					// キャッシュを整理
					if (0 != currentId) {
						requestCachedPosts.call(self);
					}
					// 今回の読み取り分を通知
					var readContinued = 0 < self.requestQue.length;
					setTimeout(function(){ self.fireEvent('readPost', {readCount: readCount, continued: readContinued}); }, 1);
					//
					if (isEmptyCachedPost_) {
						setTimeout(function(){ requestCachedPosts.call(self); }, 1);
					}
				}
				else {
// 未テスト
self.log.debug('dashboard request failed!');
					var readContinued = 0 < self.requestQue.length;
					// 読み取り失敗を通知
					setTimeout(function(){ self.fireEvent('readPost', {readCount: -1, continued: readContinued}); }, 1);
				}
				// 残りの要求キューを処理
				setTimeout(function(){ requestDashboard.call(self); }, 100);
			});
	}
	
	// キャッシュの左端(一番未来)の場合ポストを要求する
	function requestFuturePosts() {
		var self   = this;
		if (!self.cacheList.length) {
			return false;
		}
		if (!self.requestQue.length ||
			undefined == self.requestQue[self.requestQue.length - 1]['since_id']) {
			self.requestQue.push({ since_id: ''+self.cacheList[0], limit: self.postRequestLimit });
		}
		setTimeout(function(){ requestDashboard.call(self); }, 1);
		return true;
	}

	function readCache(id) {
		var self = this;
		file = Ti.Filesystem.getFile(String.format("%s/%s.json", self.cacheDir, ''+id));
		data = file.read();
		if (data && 0 < data.length) {
			return JSON.parse(data);
		}
		return {};
	}

	function isMyBlog(name) {
		var self = this;
		for (var i = 0, blog; blog = self.blogs[i]; i++) {
			if (name == blog['name']) {
				return true;
			}
		}
		return false;
	}

	function doReblog() {
		var self   = this;
		var tumblr = this.tumblr;

		if (!self.reblogQueue.length) {
			return;
		}

		var req = self.reblogQueue[0];

		var options = {
				id: '' + req['id'],
				reblog_key: req['reblog_key'],
			};

self.log.debug('reblog start #'+req['id']+' queue:'+self.reblogQueue.length);

		var timeoutAccepted = false;
		var idTimeout = setTimeout(function() {
								timeoutAccepted = true;
self.log.debug('reblog timeout queue:'+self.reblogQueue.length);
								var reblogQueue0 = self.reblogQueue.shift(); // PIN一覧には残る
								if (reblogQueue0) {
									var id = reblogQueue0['id']; // なんかえらーになる？
self.log.debug('reblog timeout #'+id+' queue:'+self.reblogQueue.length);
									setTimeout(function(){ self.fireEvent('reblog', id); }, 1);
								}
								// 次のキューを処理
								setTimeout(function(){ doReblog.call(self); }, 1);
								if (!self.reblogQueue.length) {
									setTimeout(function(){ self.fireEvent('updatePin', 0); }, 1);
								}
							}, self.postTimeout);

		tumblr.request(self.apiBaseUrl + 'v2/blog/'+req['hostname']+'/post/reblog',
			options, {}, 'POST', function(e) {
				clearTimeout(idTimeout);
				if (timeoutAccepted) {
					return;
				}
self.log.debug('reblog suceess "'+e.result.text+'"');
				var wait = 1;
				var reblogQueue0 = self.reblogQueue.shift();
				if (reblogQueue0) {
					var id = reblogQueue0['id']; // なんかえらーになる？
					var json = e.success ? JSON.parse(e.result.text || '{}') : {};
					if (e.success &&
						json['meta'] && self.STATUS_CREATED == parseInt(json['meta']['status']))
					{
						self.pin(id); // PIN一覧から削除
						setTimeout(function(){ self.fireEvent('reblog', id); }, 1);
					}
					else {
						reblogQueue0['retry']++;
						if (self.postRetryNum < reblogQueue0['retry']) {
							setTimeout(function(){ self.fireEvent('reblog', id); }, 1);
						}
						else {
							self.reblogQueue.unshift(reblogQueue0); // PIN一覧には残る
							wait = 250; // 少し時間たってからリトライ
						}
					}
				}
				// 次のキューを処理
				setTimeout(function(){ doReblog.call(self); }, wait);
				if (!self.reblogQueue.length) {
					setTimeout(function(){ self.fireEvent('updatePin', 0); }, 1);
				}
			});

	}

	function searchPost(options) {
		var self = this;
		options = options || {};
		var direction   = typeof options['direction'] == 'undefined' ? -1 : options['direction'];
		var pos         = typeof options['pos']       == 'undefined' ? -1 : options['pos'];
		var fileCount = 0;
		for (var index = 0 <= pos && pos < self.cacheList.length ? pos : self.cacheIndex,
			     last= 0 < direction ? self.cacheList.length : -1;
			index != last;
			index += direction)
		{
			var id = self.cacheList[index];
			var post = self.cacheData[id];
			if (!post['post_url']) { // からポスト？
				fileCount++;
				if ( 20 < fileCount ) {
					return { success: false, index: index };
				}
				post = undefined;
				post = readCache.call(self, id);
			}
			else {
				fileCount = 0;
			}
			if (post) {
				var success = true;
				if (self.hideMyPosts) {
					success = success & !isMyBlog.call(self, post['blog_name']);
				}
				switch (post['type']) {
				case 'text':   success = success & !self.hideTextPosts;  break;
				case 'quote':  success = success & !self.hideQuotePosts; break;
				case 'link':   success = success & !self.hideLinkPosts;  break;
				case 'answer': success = success & !self.hideAnswerPosts;break;
				case 'video':  success = success & !self.hideVideoPosts; break;
				case 'audio':  success = success & !self.hideAudioPosts; break;
				case 'photo':  success = success & !self.hidePhotoPosts; break;
				case 'chat':   success = success & !self.hideChatPosts;  break;
				}
				if (success) {
					return { success: true, index: index };
				}
			}
		}
		return { success: false, index: 0 < direction ? self.cacheList.length : -1 };
	}

	//-----------------------------------------------------

	function runPrevPost(data) {
		var self  = this;
		var index = data['index'] ? data['index'] : self.cacheIndex;
		if (self.cacheIndex < 1) {
			// キャッシュの左端(一番未来)の場合ポストを要求する
			setTimeout(function(){ fetchCommand.call(self, [
					{ type: self.CMD_REQ_FUTURE_POST },
					{ type: self.CMD_PREV_POST },
				]); }, 10);
			return false;
		}
		// 移動
		var cacheIndex = self.cacheIndex;
		index--;
		// 自分のポスト or 自分からのリブログ の場合内容をチェックする
		if (self.hideEnable) {
			var result = searchPost.call(self, {
					direction: -1,
					pos: index,
				});
			if (!result.success) {
				if (0 <= result.index) {
					setTimeout(function(){ fetchCommand.call(self, [
							{ type: self.CMD_PREV_POST, index: result.index },
						]); }, 10);
				}
				else {
					// キャッシュの左端(一番未来)の場合ポストを要求する
					setTimeout(function(){ fetchCommand.call(self, [
							{ type: self.CMD_REQ_FUTURE_POST },
							{ type: self.CMD_PREV_POST, index: result.index },
						]); }, 10);
				}
				return false;
			}
			index = result.index;
		}
		self.cacheIndex = index;
		//
		var post = self.post();
		if (isEmptyCachedPost.call(self, self.currentId())) {
			setTimeout(function(){ self.fireEvent('loading', self.currentId()); }, 1);
			requestCachedPosts.call(self, self.currentId());
		}
		else {
			setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
		}
		setTimeout(function(){ fetchCommand.call(self); }, 10);
		return true;
	}

	function runNextPost(data) {
		var self  = this;
		var index = data['index'] ? data['index'] : self.cacheIndex;
		if (self.cacheList.length <= self.cacheIndex + 1) {
			return false;
		}
		// 移動
		var cacheIndex = self.cacheIndex;
		index++;
		// 自分のポスト or 自分からのリブログ の場合内容をチェックする
		if (self.hideEnable) {
			var result = searchPost.call(self, {
					direction: 1,
					pos: index,
				});
			if (!result.success) {
				if (result.index < self.cacheList.length) {
					setTimeout(function(){ fetchCommand.call(self, [
							{ type: self.CMD_NEXT_POST, index: result.index },
						]); }, 10);
				}
				else {
					setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
				}
				return false;
			}
			index = result.index;
		}
		self.cacheIndex = index;
		//
		if (isEmptyCachedPost.call(self, self.currentId())) {
			setTimeout(function(){ self.fireEvent('loading', self.currentId()); }, 1);
			requestCachedPosts.call(self, self.currentId());
		}
		else {
			setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
		}
		setTimeout(function(){ fetchCommand.call(self); }, 10);
		return true;
	}

	function runReqFuturePost(data) {
		var self = this;
		requestFuturePosts.call(self);
	}

	function runSweepPost(data) {
		var self = this;

		if (!self.sweepPosts.length)
		{
			if (self.cacheByPostNum) {
				var top = 0, last = self.cacheByPostNumValue;
				if (self.cacheList.length <= last) {
					last = self.cacheList.length;
				}
				if (last <= self.cacheIndex) {
					top  += self.cacheIndex - last;
					last += self.cacheIndex - last;
				}
self.log.debug('cache sweep range '+top+'/'+last+' ('+self.cacheIndex+','+self.cacheList.length+')');
				for (var i = self.cacheList.length - 1; 0 <= i; i--) {
					if (i < top || last <= i) {
						self.sweepPosts.push(self.cacheList[i]);
					}
				}
			}
			if (self.cacheByPostDate) {
				var lookup = {};
				var date = new Date.getTime();
				date -= 24 * 60 * 60 * self.cacheByPostDateValue;
				for (id in self.cacheData) {
					if (self.cacheData[id]['timestamp'] < date) {
						self.sweepPosts.unshift(self.cacheList[i]);
					}
				}
			}

			if (!self.sweepPosts.length) {
				return;
			}
self.log.debug('cache sweep target '+self.sweepPosts.length);
		}

		var timeout = false;
		setTimeout(function() { timeout = true; }, 250);

		var curId = self.cacheList[self.cacheIndex];

self.log.debug('cache sweep start '+self.cacheList.length);

		while (self.sweepPosts.length && !timeout) {
			var id = self.sweepPosts.shift();
			delete self.cacheData[id];
			var fileName = String.format("%s/%s.json", self.cacheDir, ''+id);
			var file = Ti.Filesystem.getFile(fileName);
self.log.debug('cache sweep delete #'+id+' "'+fileName+(file.exists()?'" (exist)':'"'));
			if (file.exists()) {
				file.deleteFile();
			}
			for (var i = 0; i < self.cacheList.length; i++) {
				if (id == self.cacheList[i]) {
					if (i <= self.cacheIndex) {
						self.cacheIndex--;
					}
					self.cacheList.splice(i,1);
					i--;
					break;
				}
			}
		}

self.log.debug('cache sweep stop '+self.cacheList.length);

		self.cacheIndex = 0;
		for (var i = 0, num = self.cacheList.length; i < num; i++) {
			if (curId == self.cacheList[i]) {
				self.cacheIndex = i;
				break;
			}
		}

		self.saveCache();

		setTimeout(function(){ fetchCommand.call(self); }, 10);
	}

	function fetchCommand(data) {
		var self = this;
		// コマンドを追加
		if (data) {
			if (!(data instanceof Array)) {
				data = [data];
			}
			while (data.length) {
				var newCommand = data.shift();
				var type = newCommand['type'];
				var conflict = false;
				for (var i = 0, command;
					command = self.commandQueue[i]; i++) {
					if (type == command['type']) {
						conflict = true;
						break;
					}
				}
				// 前のPOSTや次のPOSTに移動の場合は重複処理を行う
				if (!conflict ||
					!(self.CMD_PREV_POST == type ||
					  self.CMD_NEXT_POST == type)) {
					self.commandQueue.push(newCommand);
				}
			}
		}
		// キューが空っぽ？
		if (!self.commandQueue.length) {
			return false;
		}
		var newCommand = self.commandQueue.shift();
		switch (newCommand.type)
		{
		case self.CMD_PREV_POST: runPrevPost.call(self, newCommand); return true;
		case self.CMD_NEXT_POST: runNextPost.call(self, newCommand); return true;
		case self.CMD_REQ_FUTURE_POST: runReqFuturePost.call(self); return true;
		case self.CMD_SWEEP_POST: runSweepPost.call(self); return true;
		}
		return true;
	}

	//-----------------------------------------------------
	// 公開メソッド
	//-----------------------------------------------------

	Dashboard.prototype.getState = function() {
		return this.state;
	}

	Dashboard.prototype.authorized = function() {
		return this.tumblr.authorized;
	}

	Dashboard.prototype.authorize = function() {
		var self   = this;
		var tumblr = this.tumblr;

		Ti.App.Properties.setString('tumblrAccessTokenKey',    '');
		Ti.App.Properties.setString('tumblrAccessTokenSecret', '');
		tumblr.authorized = false;

		self.state = self.STATE_WAIT_LOGIN;
		tumblr.authorize();
	}

	Dashboard.prototype.login = function() {
		var self   = this;
		var tumblr = this.tumblr;

		if (!tumblr.authorized) {
			return;
		}

		self.state = self.STATE_WAIT_LOGIN;
		tumblr.authorize();
	}

	// PIN数を取得
	Dashboard.prototype.totalPin = function() {
		return this.pinBuffer.length;
	}

	// PINとして保持されていたらtrueを返す
	Dashboard.prototype.pinState = function(id) {
		var self = this;
		for (var i = 0, num = self.pinBuffer.length; i < num; i++) {
			if (id == self.pinBuffer[i]) {
				return true;
			}
		}
		return false;
	}

	// IDを保持
	Dashboard.prototype.pin = function(id) {
		var self = this;
		id = id || self.currentId();
		// すでにバッファに存在する場合は削除
		for (var i = 0, num = self.pinBuffer.length; i < num; i++) {
			if (id == self.pinBuffer[i]) {
				self.pinBuffer.splice(i, 1);
				setTimeout(function(){ self.fireEvent('updatePin', id); }, 1);
				return;
			}
		}
		self.pinBuffer.push(id);
		setTimeout(function(){ self.fireEvent('updatePin', id); }, 1);
	}

	// 実データを保持しているPOST数を取得
	Dashboard.prototype.activeCachePost = function() {
		var self = this;
		var count = 0;
		for (id in self.cacheData) {
			if (!isEmptyCachedPost.call(self, id)) {
				count++;
			}
		}
		return count;
	}

	Dashboard.prototype.restCommand = function() {
		return this.commandQueue.length;
	}

	// 読み込み済みのPOST数を取得
	Dashboard.prototype.totalPost = function() {
		return this.cacheList.length;
	}

	// 現在のPOST位置を取得
	Dashboard.prototype.currentPost = function() {
		return this.cacheList.length ? this.cacheIndex + 1 : 0; // もとは0オリジンだけど1オリジンにする
	}

	// 現在のIDを取得
	Dashboard.prototype.currentId = function() {
		var self = this;
		return self.cacheList[self.cacheIndex];
	}

	// IDを指定しPOSTを取得
	Dashboard.prototype.post = function(id) {
		var self = this;
		id = id || 0;
		if (id) {
			return self.cacheData[id];
		}
		else {
			return self.cacheData[self.cacheList[self.cacheIndex]];
		}
	}

	// IDを指定しLIKE
	Dashboard.prototype.like = function(id) {
		var self = this;
	}

	// IDを指定しリブログ
	Dashboard.prototype.reblog = function(id) {
		var self = this;
		var idList = [];
		// self.blog['hostname']
		if (self.pinBuffer.length) {
			idList = self.pinBuffer;
		}
		else {
			idList.pish(id);
		}
		for (var i = 0, id; id = idList[i]; i++) {
			self.reblogQueue.push({
					id: self.cacheData[id]['id'],
					reblog_key: self.cacheData[id]['reblog_key'],
					hostname: self.blog['hostname'],
					retry: 0,
				});
		}
		setTimeout(function(){ self.fireEvent('reblogStart'); }, 1);
		//
		doReblog.call(self);
	}

	// 前のPOSTに移動
	Dashboard.prototype.prevPost = function() {
		return fetchCommand.call(this, {
					type: this.CMD_PREV_POST
				});
	}

	// 次のPOSTに移動
	Dashboard.prototype.nextPost = function() {
		return fetchCommand.call(this, {
					type: this.CMD_NEXT_POST
				});
	}

	// キャッシュを読み込み
	Dashboard.prototype.loadCache = function() {
		var self = this;
		var file, data;

		// cacheList
		file = Ti.Filesystem.getFile(self.cacheListPath);
		data = file.read();
		if (!data || data.length <= 0) {
			data = '{}';
		}
		var cacheList = JSON.parse(data);
		self.cacheList = [];
		self.cacheData = {};
		for (var i = 0, num = cacheList.length; i < num; i++) {
			var id         = cacheList[i]['id'];
			self.cacheList.push(id);
			self.cacheData[id] = cacheList[i];
		}

		// cacheIndex
		var lastId = Ti.App.Properties.getString('lastId', 0);
		self.cacheIndex = 0;
		for (var i = 0, num = self.cacheList.length; i < num; i++) {
			var id = self.cacheList[i];
			if (lastId == id) {
				self.cacheIndex = i;
				break;
			}
		}
	}

	// キャッシュを保存
	Dashboard.prototype.saveCache = function() {
		var self = this;
		var file, data;

		// cacheList
		var cacheList = [];
		for (var i = 0, num = self.cacheList.length; i < num; i++) {
			var id   = self.cacheList[i];
			var post = self.cacheData[id];
			cacheList.push({ id: id,
			                 reblog_key: post['reblog_key'],
			                 timestamp: post['timestamp']});
		}
		file = Ti.Filesystem.getFile(self.cacheListPath);
		file.write(JSON.stringify(cacheList));

		// cacheIndex
		var lastId = self.currentId();
		Ti.App.Properties.setString('lastId', lastId);
	}

	// キャッシュをクリア
	Dashboard.prototype.clearCache = function() {
		var self = this;
		self.cacheData  = {};
		self.cacheList  = [];
		self.cacheIndex = 0;
	}

	Dashboard.prototype.updateProperties = function() {
		var self = this;
		var tumblr = this.tumblr;
		// デバッグモード
		self.debugMode = Ti.App.Properties.getBool('debugMode', false)
		// HTTPS接続を行う
		self.apiBaseUrl = Ti.App.Properties.getBool('useSecureConnection', true)
		                ? 'https://api.tumblr.com/' : '';
		// リトライ回数
		self.postRetryNum = Ti.App.Properties.getInt('postRetryNum', 5);
		self.postRetryNum = self.postRetryNum ? self.postRetryNum :  5;
		Ti.App.Properties.setString('postRetryNum', ''+self.postRetryNum);
		// タイムアウト
		self.postTimeout = Ti.App.Properties.getInt('postTimeout', 10000);
		self.postTimeout = self.postTimeout ? self.postTimeout :   10000;
		Ti.App.Properties.setString('postTimeout', ''+self.postTimeout);
		// ポスト要求数
		self.postRequestLimit = Ti.App.Properties.getInt('requestLimit', 20);
		self.postRequestLimit = 1 <= self.postRequestLimit && self.postRequestLimit < 300 ? self.postRequestLimit : 20;
		Ti.App.Properties.setString('requestLimit', ''+self.postRequestLimit);
		// 自分のポストを非表示"
		self.hideMyPosts = Ti.App.Properties.getBool('hideMyPosts', false);
		// 自分からのリブログを非表示"
		self.hideReblogFromMyself = Ti.App.Properties.getBool('hideReblogFromMyself', false);
		// 投稿種別で非表示
		self.hideTextPosts   = Ti.App.Properties.getBool('hideTextPosts',   false);
		self.hidePhotoPosts  = Ti.App.Properties.getBool('hidePhotoPosts',  false);
		self.hideQuotePosts  = Ti.App.Properties.getBool('hideQuotePosts',  false);
		self.hideLinkPosts   = Ti.App.Properties.getBool('hideLinkPosts',   false);
		self.hideVideoPosts  = Ti.App.Properties.getBool('hideVideoPosts',  false);
		self.hideAudioPosts  = Ti.App.Properties.getBool('hideAudioPosts',  false);
		self.hideChatPosts   = Ti.App.Properties.getBool('hideChatPosts',   false);
		self.hideAnswerPosts = Ti.App.Properties.getBool('hideAnswerPosts', false);
		// まとめ
		self.hideEnable = self.hideMyPosts
		               || self.hideTextPosts
		               || self.hidePhotoPosts
		               || self.hideQuotePosts
		               || self.hideLinkPosts
		               || self.hideVideoPosts
		               || self.hideAudioPosts
		               || self.hideChatPosts
		               || self.hideAnswerPosts ;
		// 基準ディレクトリ
		self.baseDir = Ti.App.Properties.getString('baseDir', '');
		self.baseDir = 'file://' + self.baseDir.replace(/^file:\/\//, '');
		// キャッシュの保存先
		self.cacheDir = self.baseDir + '/json';
		var cacheDir = Ti.Filesystem.getFile(self.cacheDir);
		if (!cacheDir.exists()) {
			cacheDir.createDirectory();
		}
		// キャッシュ一覧の保存先
		self.cacheListPath = self.baseDir + '/dashboard.dat';
		// キャッシュ件数
		self.cacheByPostNum      = Ti.App.Properties.getBool('cacheByPostNum', true);
		self.cacheByPostNumValue = Ti.App.Properties.getInt('cacheByPostNumValue', 1000);
		self.cacheByPostNumValue = 260 <= self.cacheByPostNumValue ? self.cacheByPostNumValue : 260;
		Ti.App.Properties.setString('cacheByPostNumValue', ''+self.cacheByPostNumValue);
		// キャッシュ期限
		self.cacheByPostDate      = Ti.App.Properties.getBool('cacheByPostDate', false);
		self.cacheByPostDateValue = Ti.App.Properties.getInt('cacheByPostDateValue', 3);
	}

	// イベントリスナーの登録
	Dashboard.prototype.addEventListener = function(eventName, callback) {
		this.listeners = this.listeners || {};
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(callback);
	};

	// イベントの発火
	Dashboard.prototype.fireEvent = function(eventName, data) {
		var eventListeners = this.listeners[eventName] || [];
		for (var i = 0; i < eventListeners.length; i++) {
			eventListeners[i].call(this, data);
		}
	};


	return Dashboard;
})(this);
