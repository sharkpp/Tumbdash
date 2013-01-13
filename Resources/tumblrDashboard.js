// Tumblr Dashboard Component Constructor

function notify(msg) {
	if('android'==Ti.Platform.osname)Ti.UI.createNotification({message:msg}).show();
	else                             alert(msg);
}

var exports = exports || this;
exports.Dashboard = (function(global){
	var K = function(){};

	var Dashboard = function(tumblr) {
		var self;

		if (this instanceof Dashboard) {
			self = this;
		} else {
			self = new K();
		}

//		initTaskList.call(self);
		self.networkTask = lib.Job.createTask({
				title: 'network',
				context: self,
				background: true,
				idle: TASK_IDLE,
				stateList: TASK_INFO,
				timeout: 10000,
				withExec: true,
			});
		self.networkSlot = lib.Job.createSlot({
				title: 'networkSlot',
				context: self,
				retryCount: 10,
				withExec: true,
			});
		self.networkSlot.setupSlot(reqImageSlot, 10);
		self.foregroundTask = lib.Job.createTask({
				title: 'foreground',
				context: self,
				background: true,
				idle: CMD_IDLE,
				stateList: CMD_INFO,
				timeout: 1000,
			});
		self.backgroundTask = lib.Job.createTask({
				title: 'background',
				context: self,
				background: true,
				idle: WORK_IDLE,
				stateList: WORK_INFO,
			//	timeout: 1000,
			});

		var beforeOrAfterTaskCall = function(e) {
lib.Log.debug(e.source.title + ':'+e.type+'('+e.source.getStateText(e.state)+') ====== ');
			setTimeout(function(){ self.fireEvent('debug'); }, 1);
		}

		self.networkTask.addEventListener('before',    beforeOrAfterTaskCall);
		self.foregroundTask.addEventListener('before', beforeOrAfterTaskCall);
		self.backgroundTask.addEventListener('before', beforeOrAfterTaskCall);
		self.networkTask.addEventListener('after',    beforeOrAfterTaskCall);
		self.foregroundTask.addEventListener('after', beforeOrAfterTaskCall);
		self.backgroundTask.addEventListener('after', beforeOrAfterTaskCall);

		tumblr.addEventListener('login', self.networkTask.createCallback(callbackLogin));

		self.blog  = {};
		self.blogs = [];
		self.listeners = {};
		self.tumblr = tumblr;
		self.pinBuffer  = []; // PINバッファ
		self.cacheData  = {}; // post id : 投稿内容
		self.cacheList  = []; // 順序 : post id のリスト
		self.cacheIndex = 0;  // cacheListの参照位置(-1の場合は未来を取得中)

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
	Ti.API.debug('CMD_JUMP_POST=' + CMD_JUMP_POST);
		lib.Log.debug('CMD_JUMP_POST');
		lib.Log.debug('CMD_JUMP_POST=' + CMD_JUMP_POST);

		return self;
	};

	K.prototype = Dashboard.prototype;

	var lib = require('lib');

	// Return codes
	var STATUS_OK      = 200; // 200: OK
	var STATUS_CREATED = 201; // 201: Created

/*
U:UIタスク
F:フォアグラウンドタスク(CMD_*)(すぐ終わりそうな処理、UIがハングアップしないようにするため)
B:バックグラウンドタスク(TASK_*)(時間掛かりそうな処理、要求によってor内部状態を見て勝手に動作)

次のポストに移動
	U:画面は取得中の表示
		F:次のポストを探す
		　←見つかった
	U:ポストを表示
		　↓見つからない
x		F:Bに次要求
		F:Bに完了通知タスクを登録(何もなかったらすぐ呼ばれる)
		　←ポスト内容を調べ見つかった
	U:ポストを表示
		　↓見つからなかったしポストも取得できなかった
	U:現在位置を戻す
		　↓見つからなかった
		　続けて探す
		　

			Bに次のポストとの取得を要求
			B:ポストの要求
			

	U:現在ポスト移動
		F:メモリ上に保持しているキャッシュがなくなりそうなら読み込む
	U:ある場合、そのまま表示
	U:ない場合、優先順位高めでバックグラウンドにタスク登録
			B:バックグラウンド完了
	U:同じIdならポストを表示
	
*/

	// 非ネットワーク処理で時間がかからないもの
	var CMD_INFO = {};
	var CMD_IDLE            = 0; CMD_INFO[CMD_IDLE]      = 'IDLE';      // 待機
	var CMD_PREV_POST       = 1; CMD_INFO[CMD_PREV_POST] = 'PREV_POST'; // 前のPOSTを取得
	var CMD_NEXT_POST       = 2; CMD_INFO[CMD_NEXT_POST] = 'NEXT_POST'; // 次のPOSTを取得
	var CMD_JUMP_POST       = 3; CMD_INFO[CMD_JUMP_POST] = 'JUMP_POST'; // 指定のPOSTに移動

	// 非ネットワーク処理で時間がかかるもの
	var WORK_INFO = {};
	var WORK_IDLE         = 0; WORK_INFO[WORK_IDLE]         = 'IDLE';         // 待機
	var WORK_RESTORE_POST = 1; WORK_INFO[WORK_RESTORE_POST] = { text: 'RESTORE_POST', duplicate: false }; // ポストの読み込み
	var WORK_SWEEP_POST   = 2; WORK_INFO[WORK_SWEEP_POST]   = 'SWEEP_POST';   // ポストの整理
	var WORK_SWEEP_CACHE  = 3; WORK_INFO[WORK_SWEEP_CACHE]  = 'SWEEP_CACHE';  // キャッシュの整理
	var WORK_REMOVE_POST  = 4; WORK_INFO[WORK_REMOVE_POST]  = 'REMOVE_POST';  // ポストの削除

	// ネットワーク系の処理
	var TASK_INFO = {};
	var TASK_IDLE          = 0; TASK_INFO[TASK_IDLE]          = 'IDLE';          // 待機
	var TASK_LOGGING_IN    = 1; TASK_INFO[TASK_LOGGING_IN]    = 'LOGGING_IN';    // ログイン中
	var TASK_REQ_USER_INFO = 2; TASK_INFO[TASK_REQ_USER_INFO] = 'REQ_USER_INFO'; // ユーザー情報取得中
	var TASK_REQ_DASHBOARD = 3; TASK_INFO[TASK_REQ_DASHBOARD] = 'REQ_DASHBOARD'; // ダッシュボード取得中
	var TASK_REQ_IMAGE     = 4; TASK_INFO[TASK_REQ_IMAGE]     = 'REQ_IMAGE';     // 画像取得中
	var TASK_REBLOG        = 8; TASK_INFO[TASK_REBLOG]        = 'REBLOG';        // リブログ指示
	var TASK_LIKE          = 9; TASK_INFO[TASK_LIKE]          = 'LIKE';          // ライク指示


	////////////////////////////////////////////////////////////////////////////
	// ネットワーク処理

	function callbackLogin(e) {
		var self = this;
		lib.Log.debug('callbackLogin ***********');

		if (e.success) {
			lib.Log.debug('login suceess');
		//	lib.Log.debug('tumblrAccessTokenKey=' + e.accessTokenKey);
		//	lib.Log.debug('tumblrAccessTokenSecret=' + e.accessTokenSecret);
			Ti.App.Properties.setString('tumblrAccessTokenKey',    e.accessTokenKey);
			Ti.App.Properties.setString('tumblrAccessTokenSecret', e.accessTokenSecret);
			//
			setTimeout(function(){ self.fireEvent('login', {success:true}); }, 1);
			//
			self.networkTask.add(userInfoTask);
		}
		else {
			//
			setTimeout(function(){ self.fireEvent('login', {success:false}); }, 1);
		}
		self.networkTask.exit(true);
	}

	// ログイン処理
	function loginTask() {
		var self = this;
lib.Log.debug('loginTask ***********');
		return {
			state: TASK_LOGGING_IN,
			exec: function() {
lib.Log.debug('loginTask #2 ***********');
				self.tumblr.authorize();
			},
		};
	}

	// ユーザー情報の取得
	function userInfoTask() {
		var self = this;
lib.Log.debug('userInfoTask ***********');
		return {
			state: TASK_REQ_USER_INFO,
			exec: function() {
lib.Log.debug('userInfoTask #2 ***********');
				// 既に情報を取得済み？
				var beginRead = false;
				if (self.cacheList.length && self.blog['name']) {
					beginRead = true;
					self.backgroundTask.add(restorePostTask);
				}

				self.tumblr.request(self.apiBaseUrl + 'v2/user/info', {}, {}, 'POST', 
						self.networkTask.createCallback(function(e) {
lib.Log.debug('userInfoTask #3 ***********');
							if (e.success && e.result.text) {
								// 受信データ解析
								var json = JSON.parse(e.result.text || '{}');
								var blogs = json['response']['user']['blogs']
								updateBlogsInfo.call(self, blogs);
								Ti.App.Properties.setString('blogsInfo', JSON.stringify(blogs));
								//
								self.networkTask.add(reqDashboardTask);
								// POST取得開始
								if (!beginRead) {
									self.backgroundTask.add(restorePostTask);
								}
							}
							else {
							}
							self.networkTask.exit(true);
						}));
			},
			timeoutExec: function() {
				self.networkTask.exit(false);
			},
		};
	}

	function callbackReqDashboard(e) {
lib.Log.debug('callbackReqDashboard ********');
		var self = this;
		if (e.success && e.result.text) {
			// キューを消費
			self.requestQue.shift();
			// 受信データ解析
			var json  = JSON.parse(e.result.text);
			var posts = json['response']['posts']; // POST
			var currentId = self.currentId(); // 現在選択中のID
			var pastRequesting = self.cacheIndex < 0;
			var topPostId = 0 < self.cacheList.length ? self.cacheList[0] : 0;
			var readCurrentPost = false;
//			var isEmptyCachedPost_ = 1 == posts.length && isEmptyCachedPost.call(self, posts[0]['id']);
			// POSTを追加
			var readCount = 0;
lib.Log.debug('current #'+currentId);
			for (var i = posts.length - 1, post; post = posts[i]; i--) {
				var postId = post['id'];
				var existPost = undefined != self.cacheData[postId];
				self.cacheData[postId] = post;
				if (pastRequesting && 
					(0 == topPostId || postId < topPostId)) {
lib.Log.debug('update current to #'+postId+' top #'+topPostId);
					currentId = postId;
					pastRequesting = false;
				}
lib.Log.debug('recv post #'+postId+' '+(existPost?'(already exist)':'')+(postId == currentId?' (read current)':''));
				if (!existPost) {
					self.cacheList.push(postId);
					readCount++;
				}
				if (postId == currentId) {
					readCurrentPost = true;
				}
				// ファイルの保存
				var file = Ti.Filesystem.getFile(String.format("%s/%s.json", self.cacheDir, ''+postId));
				file.write(JSON.stringify(post));
				// 画像の場合は取得タスクに追加
				var images = collectImageFromPost.call(self, post);
				self.networkSlot.add(images);
			}
lib.Log.debug('#1');
			self.cacheList.sort(function(a,b){
					if (a != b) {
						return a < b ? 1 : -1;
					}
					return 0;
				});
lib.Log.debug('#2');
			if (!currentId) {
				self.cacheIndex = self.cacheList.length - 1;
				readCurrentPost = true;
			}
			// 現在位置がずれていたら移動
			if (currentId != self.cacheList[self.cacheIndex]) {
				for (var i = 0, num = self.cacheList.length; i < num; i++) {
					if (currentId == self.cacheList[i]) {
						self.cacheIndex = i;
						break;
					}
				}
			}
			// 通知
			if (readCurrentPost) {
				setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
			}
			// キャッシュを整理
			if (0 != currentId) {
				self.backgroundTask.add(sweepPostTask);
				self.backgroundTask.add(sweepCacheTask);
			}
			// 今回の読み取り分を通知
			var readContinued = 0 < self.requestQue.length;
			setTimeout(function(){ self.fireEvent('readPost', {readCount: readCount, continued: readContinued}); }, 1);

			if (readCount) {
				self.networkTask.add(reqDashboardTask);
			}
		}
		else {
// 未テスト
lib.Log.debug('dashboard request failed!');
			var readContinued = 0 < self.requestQue.length;
			// 読み取り失敗を通知
			setTimeout(function(){ self.fireEvent('readPost', {readCount: -1, continued: readContinued}); }, 1);
		}
		// 残りの要求キューを処理
//		self.networkTask.add(reqDashboardTask);
		self.networkTask.exit(e.success && e.result.text);
	}
	
	// ダッシュボード取得中
	function reqDashboardTask(params) {
		var self = this;
		params = params || {};
lib.Log.debug('reqDashboardTask ***********');
		return {
			state: TASK_REQ_DASHBOARD,
			exec: function() {
				var tumblr = self.tumblr;

				var options = {};

				// 取得制限を設定から指定
				options['limit'] = self.postRequestLimit;

				var forceSinceId = params.sinceId || 0;

				if (!forceSinceId) {
					// 現在位置から見て足りない部分があれば取得する
					if (!getDashboardRequest.call(self, options)) {
lib.Log.debug('reqDashboardTask: #1');
						// 取得中止
						self.networkTask.exit(true);
						return;
					}
				}
				else {
					options = {
						since_id: ''+forceSinceId
					};
				}

				var url = self.apiBaseUrl + 'v2/user/dashboard';

				// リブログ情報も取得
				url += '?reblog_info=true';
lib.Log.debug(url);
lib.Log.debug(JSON.stringify(options));
				tumblr.request(url, options, {}, 'POST', 
				               self.networkTask.createCallback(callbackReqDashboard));
			},
			timeoutExec: function() {
				self.networkTask.exit(false);
			},
		};
	}
	
	function collectImageFromPost(post) {
		var self = this;
		var images = [];
		switch (post['type']) {
		case 'photo':
			for (var i = 0, photo; photo = post['photos'][i]; i++) {
				if (self.photoSize < 0 && photo['original_size']) {
					images.push(photo['original_size']['url']);
				}
				else {
					var width = 0;
					for (var j = 0, alt_photo; alt_photo = photo['alt_sizes'][j]; j++) {
						if (alt_photo['width'] <= self.photoSize &&
							width < alt_photo['width']) {
							images.push(alt_photo['url']);
							width = alt_photo['width'];
						}
					}
				}
			}
			break;
		default:
			break;
		}
		return images;
	}

	// 画像取得中
	function reqImageSlot(url) {
		var self = this;
		// 既に存在するファイルを除外する
		var fname = url.split('/').pop();
		var path = self.imageDir + '/' + fname;
		var imageFile = Ti.Filesystem.getFile(path);
lib.Log.debug('start '+url+' '+(imageFile.exists()?'(exist)':''));
		if (imageFile.exists() && 0 < imageFile.size) {
			return false;
		}
		// キャッシュのダウンロード処理
		var client = Ti.Network.createHTTPClient({
				onload: self.networkSlot.createCallback(function(e){
//						var url = e.source.location;
						// ファイルの保存
						var fname = url.split('/').pop();
						var path = self.imageDir + '/' + fname;
lib.Log.debug('save '+url+','+path);
						var image = Ti.Filesystem.getFile(path);
						image.write(e.source.responseData);
						// 処理を再試行するか？
						if (!e.source.responseData.length) {
							return false;
						}
						//
						return true;
					}),
				onerror: self.networkSlot.createCallback(function(e) {
//									var url = e.source.location;
lib.Log.debug('failed '+url);
						return false;
					}),
				timeout: 5000
			});
		client.open('GET', url);
		client.send();
	}

	function getDashboardRequest(options) {
		var self = this;

		// キャッシュが空っぽの場合はAPIで取得できる最後を取得する
		if (!self.cacheList.length &&
			0 != self.cacheLastPostId) {
			// キャッシュが壊れてたので復帰
			options['since_id'] = ''+(self.cacheLastPostId-1);
			self.cacheLastPostId = 0;
		}
		else if (!self.cacheList.length) {
			options['offset'] = 260 - self.postRequestLimit;
			options['limit'] = self.postRequestLimit;
		}
		else {
			
//			var curId = self.cacheList[self.cacheIndex];

			// 取得方向、trueは新しい方
			var requestDir = self.cacheList.length - self.cacheIndex < self.cacheIndex ? false : true;

			// キャッシュにまだ追加できるならばどんどん読み込む
			if (self.postRequestLimit < self.cacheByPostNumValue - self.cacheList.length)
			{
				if (requestDir) {
					options['since_id'] = ''+self.cacheList[0];
				}
				else {
lib.Log.debug('getDashboardRequest #1 '+self.cacheList.length+' '+self.cacheIndex);
					//どうやろう？
//					return false;
					options['since_id'] = ''+self.cacheList[0];
				}
			}
			else {
				if (self.cacheIndex < self.postRequestLimit) {
					options['since_id'] = ''+self.cacheList[0];
				}
				else if (self.cacheList.length - self.cacheIndex < self.postRequestLimit) {
lib.Log.debug('getDashboardRequest #2'+self.cacheList.length+' '+self.cacheIndex);
					//どうやろう？
					return false;
				}
			}

		}

		return true;
	}

	////////////////////////////////////////////////////////////////////////////
	// バックグラウンド処理

	// ポストの読み込み
	function restorePostTask(params) {
		var self = this;
		var params = params || {};
lib.Log.debug('restorePostTask ***********');
		return {
			state: WORK_RESTORE_POST,
			exec: function() {
					var currentId = self.currentId(); // 現在選択中のID
					var readCurrentPost = false;
					// 現在のポストが不明
					if (!currentId) {
lib.Log.debug('read failed current id empty!');
						self.backgroundTask.exit(true);
						return;
					}
					var readFailed = [];
					var readList = params.target || [];
					if (readList.length < 2) {
						var cacheIndex = self.cacheIndex;
						if (readList.length) { // 指定がある場合はインデックスに変換
							for (var i = 0, postId; postId = self.cacheList[i]; i++) {
								if (readList[0] == postId) {
									cacheIndex = i;
									break;
								}
							}
						}
						// 読み込み対象が指定されていない場合は
						// 現在のポスト位置からキャッシュ範囲を決めて
						var readTop  = Math.max(self.cacheIndex - Math.round(self.postRequestLimit / 2), 0);
						var readLast = Math.min(self.cacheIndex + self.postRequestLimit - Math.round(self.postRequestLimit / 2), self.cacheList.length - 1);
						for (var i = readLast; readTop <= i; i--) {
							var postId = self.cacheList[i];
							readList.push(postId);
						}
					}
					// ファイルからデータを読み込む
lib.Log.debug('read #'+(readList.length?readList[0]:0)+' - #'+(readList.length?readList[readList.length - 1]:0)+' count='+readList.length);
					var task = lib.Job.foreach(readList, function(postId){
							var path = String.format("%s/%s.json", self.cacheDir, ''+postId);
lib.Log.debug('read #'+postId+' '+path);
							var file = Ti.Filesystem.getFile(path);
							var data = file.read();
							try {
								var json = JSON.parse(data);
								self.cacheData[postId] = json;
								if (postId == currentId) {
									readCurrentPost = true;
								}
								// 画像の場合は取得タスクに追加
								var images = collectImageFromPost.call(self, json);
								self.networkSlot.add(images);
							}
							catch(e) {
								readFailed.push(postId);
							}
							return true;
						});
					task.addEventListener('complite', function(e){
						if (readCurrentPost) {
							setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
						}
						if (readFailed.length) {
lib.Log.debug('read failed!! num:'+readFailed.length+' #'+readFailed[0]+' - #'+readFailed[readFailed.length - 1]);
							self.networkTask.add(reqDashboardTask, { sinceId: readFailed.shift() - 1 });
						}
						// 終了
						self.backgroundTask.exit(true);
					});
					task.exec();
				},
			timeout: 0,
		};
	}

	// ポストの整理
	function sweepPostTask() {
		var self = this;
lib.Log.debug('sweepPostTask ***********');
		return {
			state: WORK_SWEEP_POST,
			exec: function() {
					// 保持範囲を現在の位置から決めて
					var cacheTop  = Math.max(self.cacheIndex - self.postRequestLimit * 2, 0);
					var cacheLast = Math.min(self.cacheIndex + self.postRequestLimit * 2, self.cacheList.length - 1);
					for (var i = 0; i < self.cacheList.length; i++) {
						if (i < cacheTop || cacheLast < i) {
							// それ以外のポストを削除
							var postId = self.cacheList[i];
							var post = self.cacheData[postId];
							self.cacheData[postId] = {
									id: postId,
									reblog_key: post['reblog_key'],
									timestamp: post['timestamp'],
								};
						}
					}
					self.backgroundTask.exit(true);
				},
			timeout: 0,
		};
	}

	// キャッシュの整理
	function sweepCacheTask() {
		var self = this;
lib.Log.debug('sweepCacheTask ***********');
		return {
			state: WORK_SWEEP_CACHE,
			exec: function() {
					// キャッシュ数をチェック
					if (self.cacheList.length <= self.cacheByPostNumValue) {
						self.backgroundTask.exit(true);
						return;
					}

					// 取得方向、trueは新しい方
					var requestDir = self.cacheList.length - self.cacheIndex < self.cacheIndex ? false : true;

					var top  = 0;
					var last = self.cacheList.length - self.cacheByPostNumValue;
					var step = 1;
					if (!requestDir) {
						top = self.cacheList.length - 1;
						last = self.cacheByPostNumValue;
						step = -1;
					}
lib.Log.debug('cacheList.lengt='+self.cacheList.length+' cacheByPostNumValue'+self.cacheByPostNumValue+' '+top+'/'+last);
					var removeList = [];
					for (var i = top; i != last; i += step) {
						var postId = self.cacheList[i];
						var post = self.cacheData[postId];
						// 関連する画像キャッシュを削除
						var images = collectImageFromPost.call(self, post);
						for (var j = 0, image; image = images[j]; j++) {
							removeList.push(String.format("%s/%s", self.imageDir, image.split('/').pop()));
						}
						// ポストのキャッシュを削除
						removeList.push(String.format("%s/%s.json", self.cacheDir, ''+postId));
					}

					var removeTask = function() {
						if ( removeList.length ) {
							var filename = removeList.shift();
							var file = Ti.Filesystem.getFile(filename);
lib.Log.debug('cache sweep delete "'+filename+(file.exists()?'" (exist)':'"'));
							if (file.exists()) {
								file.deleteFile();
							}
							setTimeout(removeTask, 1);
						}
						else {
							self.backgroundTask.exit(true);
						}
					};

					removeTask();
				},
			timeout: 0,
		};
	}

	////////////////////////////////////////////////////////////////////////////
	// フォアグラウンド処理

	// 前のポストを表示
	function prevPostTask() {
		var self = this;
		return {
			state: CMD_PREV_POST,
			exec: function() {
					self.cacheIndex--;
					if (self.cacheIndex < 0) {
						// 未来のポストを取得
lib.Log.debug('prevPostTask #1');
					}
					else {
						// 前のポストを取得
						var currentId = self.currentId();
						if (undefined != self.cacheData[currentId]) {
							// キャッシュ内に存在する
							if (isEmptyCachedPost.call(self, currentId)) {
lib.Log.debug('prevPostTask #2');
								// キャッシュ内には存在するけどメモリ上に実体が読み込まれていない
								self.backgroundTask.add(restorePostTask, { target: [ ''+currentId ] });
							}
							else {
lib.Log.debug('prevPostTask #3');
								// 実体も存在したのですぐ表示する
								setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
							}
						}
						else if (currentId) {
lib.Log.debug('prevPostTask #4');
							self.backgroundTask.add(restorePostTask, { target: [ ''+currentId ] });
						}
						else {
lib.Log.debug('prevPostTask #5');
							self.networkTask.add(reqDashboardTask);
						}
					}
//					self.networkTask.add(reqDashboardTask);
					self.foregroundTask.exit(true);
				},
		};
	}

	// 次のポストを表示
	function nextPostTask() {
		var self = this;
		return {
			state: CMD_NEXT_POST,
			exec: function() {
					self.cacheIndex++;
					if (self.cacheList.length <= self.cacheIndex) {
						// 未来のポストを取得
						// とりあえず、今は移動できないことにする
						self.cacheIndex = self.cacheList.length - 1;
					}
					else {
						// 次のポストを取得
						var currentId = self.currentId();
						if (undefined != self.cacheData[currentId]) {
							// キャッシュ内に存在する
							if (isEmptyCachedPost.call(self, currentId)) {
								// キャッシュ内には存在するけどメモリ上に実体が読み込まれていない
								self.backgroundTask.add(restorePostTask, { target: [ ''+currentId ] });
							}
							else {
								// 実体も存在したのですぐ表示する
								setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
							}
						}
						else {
							self.backgroundTask.add(restorePostTask, { target: [ ''+currentId ] });
						}
					}
					self.networkTask.add(reqDashboardTask);
					self.foregroundTask.exit(true);
				},
		};
	}


















//////////////////////////////////////////////////////////////////////////////////
// 古い処理
//////////////////////////////////////////////////////////////////////////////////

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

	function isEmptyCachedPost(id) {
		var self = this;
		return self.cacheData[id] && !self.cacheData[id]['post_url'];
	}

	function requestCachedPosts(targetId) {
return;
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
return;
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

		tumblr.request(self.apiBaseUrl + 'v2/user/dashboard' + '?reblog_info=true', options, {}, 'POST', function(e) {
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
//					var isEmptyCachedPost_ = 1 == posts.length && isEmptyCachedPost.call(self, posts[0]['id']);
					// POSTを追加
					var readCount = 0;
					var readPosts = {};
					for (var i = 0, post; post = posts[i]; i++) {
						var postId = post['id'];
						var existPost = undefined != self.cacheData[postId];
						self.cacheData[postId] = post;
lib.Log.debug('recv post #'+postId+' '+(existPost?'(already exist)':''));
						if (!existPost) {
							self.cacheList.push(postId);
							readCount++;
							readPosts[postId] = postId;
						}
						// ファイルの保存
						var file = Ti.Filesystem.getFile(String.format("%s/%s.json", self.cacheDir, ''+postId));
						file.write(JSON.stringify(post));
					}
lib.Log.debug('#3');
					self.cacheList.sort(function(a,b){
							if (a != b) {
								return a < b ? 1 : -1;
							}
							return 0;
						});
lib.Log.debug('#4');
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
//						if (isEmptyCachedPost.call(self, currentId)) {
//							setTimeout(function(){ self.fireEvent('loading', currentId); }, 1);
//							requestCachedPosts.call(self, currentId);
//						}
//						else {
//							setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
//						}
					}
					setTimeout(function(){ self.fireEvent('loadComplite', readPosts); }, 1);
					// キャッシュを整理
//					if (0 != currentId) {
//						requestCachedPosts.call(self);
//					}
					// 今回の読み取り分を通知
//					var readContinued = 0 < self.requestQue.length;
//					setTimeout(function(){ self.fireEvent('readPost', {readCount: readCount, continued: readContinued}); }, 1);
					//
//					if (isEmptyCachedPost_) {
//						setTimeout(function(){ requestCachedPosts.call(self); }, 1);
//					}
				}
				else {
// 未テスト
lib.Log.debug('dashboard request failed!');
//					var readContinued = 0 < self.requestQue.length;
//					// 読み取り失敗を通知
//					setTimeout(function(){ self.fireEvent('readPost', {readCount: -1, continued: readContinued}); }, 1);
				}
				// 残りの要求キューを処理
				setTimeout(function(){ requestDashboard.call(self); }, 100);
			});
	}
	
	// キャッシュの左端(一番未来)の場合ポストを要求する
	function requestFuturePosts() {
return false;
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
return {};
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
	
	function isReblogFromMyBlog(post) {
		var self = this;
		var from_name = post['reblogged_from_name'] || '';
		var root_name = post['reblogged_root_name'] || '';
		if (from_name || root_name) {
			for (var i = 0, blog; blog = self.blogs[i]; i++) {
				if (root_name == blog['name'] ||
					from_name == blog['name']) {
					return true;
				}
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
		var hostname = req['hostname'];

		var options = {
				id: '' + req['id'],
				reblog_key: req['reblog_key'],
			};
		if (req['tags'] && req['tags'].length) { // タグを追加
			options['tags'] = req['tags'];
		}
		if (req['comment']) { // コメントを追加
			options['comment'] = req['comment'];
		}

lib.Log.debug('reblog start #'+req['id']+' queue:'+self.reblogQueue.length);

		var timeoutAccepted = false;
		var idTimeout = setTimeout(function() {
								timeoutAccepted = true;
lib.Log.debug('reblog timeout queue:'+self.reblogQueue.length);
								var reblogQueue0 = self.reblogQueue.shift(); // PIN一覧には残る
								if (reblogQueue0) {
									var id = reblogQueue0['id']; // なんかえらーになる？
lib.Log.debug('reblog timeout #'+id+' queue:'+self.reblogQueue.length);
									setTimeout(function(){ self.fireEvent('reblog', id); }, 1);
								}
								// 次のキューを処理
								setTimeout(function(){ doReblog.call(self); }, 1);
								if (!self.reblogQueue.length) {
									setTimeout(function(){ self.fireEvent('updatePin', 0); }, 1);
								}
							}, self.postTimeout);

		tumblr.request(self.apiBaseUrl + 'v2/blog/'+hostname+'/post/reblog',
			options, {}, 'POST', function(e) {
				clearTimeout(idTimeout);
				if (timeoutAccepted) {
					return;
				}
lib.Log.debug('reblog suceess "'+e.result.text+'"');
				var wait = 1;
				var reblogQueue0 = self.reblogQueue.shift();
				if (reblogQueue0) {
					var id = reblogQueue0['id']; // なんかえらーになる？
					var json = e.success ? JSON.parse(e.result.text || '{}') : {};
					if (e.success &&
						json['meta'] && self.STATUS_CREATED == parseInt(json['meta']['status']))
					{
						if (self.pinBuffer.length) {
							self.pin(id); // PIN一覧から削除
						}
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
				if (self.hideMyPosts) { // 自分のポストを非表示
					success = success & !isMyBlog.call(self, post['blog_name']);
				}
				if (self.hideReblogFromMyself) { // 自分からのリブログを非表示
					success = success & !isReblogFromMyBlog.call(self, post);
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
		var index = typeof data['index'] == 'undefined' ? self.cacheIndex : data['index'];
		var reclusive = typeof data['reclusive'] != 'undefined';
		if (self.cacheIndex < 1) {
			// キャッシュの左端(一番未来)の場合ポストを要求する
			if (!reclusive) {
				setTimeout(function(){ fetchCommand.call(self, [
						{ type: self.CMD_REQ_FUTURE_POST },
						{ type: self.CMD_PREV_POST, reclusive: true },
					]); }, 10);
			}
			else {
				setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
			}
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
		var index = typeof data['index'] == 'undefined' ? self.cacheIndex : data['index'];
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

	function runJumpPost(data) {
		var self   = this;
		var index  = typeof data['index'] == 'undefined' ? -1 : data['index'];
		var reverse= typeof data['reverse'] != 'undefined';
lib.Log.debug('jump to #1 '+index+','+reverse+' ('+self.cacheIndex+','+self.cacheList.length+')');
		if (index < 0 || self.cacheList.length <= index) {
			return false;
		}
		if (index == self.cacheIndex) {
			return true;
		}
		var direction = index < self.cacheIndex ? -1 : 1;
		    direction = reverse ? -direction : direction; // 向きを反転
		// 自分のポスト or 自分からのリブログ の場合内容をチェックする
		if (self.hideEnable) {
			var result = searchPost.call(self, {
					direction: direction,
					pos: index,
				});
lib.Log.debug('jump to #2 '+result.success+','+result.index);
			if (!result.success) {
				if (0 <= result.index && result.index < self.cacheList.length) {
					setTimeout(function(){ fetchCommand.call(self, [
							{ type: self.CMD_JUMP_POST, index: result.index },
						]); }, 10);
				}
				else {
					if (!reverse) {
						setTimeout(function(){ fetchCommand.call(self, [
								{ type: self.CMD_JUMP_POST, index: result.index < 0 ? 0 : self.cacheList.length - 1, reverse: true },
							]); }, 10);
					}
					else {
						setTimeout(function(){ self.fireEvent('loadComplite', self.post()); }, 1);
					}
				}
				return false;
			}
			index = result.index;
		}
lib.Log.debug('jump to #3 '+index+' ('+self.cacheIndex+','+self.cacheList.length+')'+self.currentId());
		self.cacheIndex = index;
lib.Log.debug('jump to #4 '+index+' ('+self.cacheIndex+','+self.cacheList.length+')'+self.currentId());
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
lib.Log.debug('cache sweep range '+top+'/'+last+' ('+self.cacheIndex+','+self.cacheList.length+')');
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
lib.Log.debug('cache sweep target '+self.sweepPosts.length);
		}

		var timeout = false;
		setTimeout(function() { timeout = true; }, 250);

		var curId = self.cacheList[self.cacheIndex];

lib.Log.debug('cache sweep start '+self.cacheList.length);

		while (self.sweepPosts.length && !timeout) {
			var id = self.sweepPosts.shift();
			delete self.cacheData[id];
			var fileName = String.format("%s/%s.json", self.cacheDir, ''+id);
			var file = Ti.Filesystem.getFile(fileName);
lib.Log.debug('cache sweep delete #'+id+' "'+fileName+(file.exists()?'" (exist)':'"'));
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

lib.Log.debug('cache sweep stop '+self.cacheList.length);

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
				// 前のPOSTや次のPOSTに移動の場合は重複チェック処理を行う
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
		case self.CMD_JUMP_POST: runJumpPost.call(self, newCommand); return true;
		case self.CMD_REQ_FUTURE_POST: runReqFuturePost.call(self);  return true;
		case self.CMD_SWEEP_POST: runSweepPost.call(self); return true;
		}
		return true;
	}

	//-----------------------------------------------------
	// 公開メソッド
	//-----------------------------------------------------

	Dashboard.prototype.getState = function() {
		return {
				network:    ''+this.networkTask.getStateText()+'/'+this.networkTask.getTaskCount(),
				networkSlot:''+this.networkSlot.getItemCount(),
				foreground: ''+this.foregroundTask.getStateText()+'/'+this.foregroundTask.getTaskCount(),
				background: ''+this.backgroundTask.getStateText()+'/'+this.backgroundTask.getTaskCount(),
			};
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

		self.networkTask.add(loginTask);
	}

	Dashboard.prototype.login = function() {
		var self   = this;
		var tumblr = this.tumblr;

		if (!tumblr.authorized) {
			return;
		}

		self.networkTask.add(loginTask);
	}

	// PIN状態をクリア
	Dashboard.prototype.pinClear = function() {
		this.pinBuffer = [];
	}

	// PIN数を取得
	Dashboard.prototype.totalPin = function() {
		return this.pinBuffer.length;
	}

	// PINとして保持されていたらtrueを返す
	Dashboard.prototype.pinState = function(id) {
		var self = this;
		id = id || self.currentId();
		for (var i = 0, num = self.pinBuffer.length; i < num; i++) {
			if (id == self.pinBuffer[i]['id']) {
				return true;
			}
		}
		return false;
	}

	// IDを保持
	Dashboard.prototype.pin = function(id, tags, comment, liked) {
		var self = this;
		id   = id || self.currentId();
		tags = tags || '';
		comment = comment || '';
		liked = liked || false;
		// すでにバッファに存在する場合は削除
		for (var i = 0, num = self.pinBuffer.length; i < num; i++) {
			if (id == self.pinBuffer[i]['id']) {
				self.pinBuffer.splice(i, 1);
				setTimeout(function(){ self.fireEvent('updatePin', id); }, 1);
				return;
			}
		}
		self.pinBuffer.push({ id: id, tags: tags, comment: comment, liked: liked });
		setTimeout(function(){ self.fireEvent('updatePin', id); }, 1);
	}

	// 実データを保持しているPOST数を取得
	Dashboard.prototype.activeCacheCount = function() {
		var self = this;
		var count = 0;
		for (id in self.cacheData) {
			if (!isEmptyCachedPost.call(self, id)) {
				count++;
			}
		}
		return count;
	}

	// 実データを保持しているPOST数を取得
	Dashboard.prototype.activeCacheTop = function() {
		var self = this;
		for (var i = 0; i < self.cacheList.length; ++i) {
			if (!isEmptyCachedPost.call(self, self.cacheList[i])) {
lib.Log.debug('Dashboard.activeCacheTop -> '+(i+1));
				return i + 1;
			}
		}
lib.Log.debug('Dashboard.activeCacheLast -> not found');
		return 0;
	}

	// 実データを保持しているPOST数を取得
	Dashboard.prototype.activeCacheLast = function() {
		var self = this;
		for (var i = self.cacheList.length - 1; 0 <= i; --i) {
			if (!isEmptyCachedPost.call(self, self.cacheList[i])) {
lib.Log.debug('Dashboard.activeCacheTop -> '+(i+1));
				return i + 1;
			}
		}
lib.Log.debug('Dashboard.activeCacheLast -> not found');
		return 0;
	}

	// 保持しているキャッシュの一覧を取得
	Dashboard.prototype.getCachedPostId = function() {
		var self = this;
		var list = [];
		for (var i = 0, num = self.cacheList.length; i < num; i++) {
			list.push(self.cacheList[i]);
		}
		return list;
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

	// IDから位置を取得
	Dashboard.prototype.findPost = function(id) {
		var self = this;
		for (var i = 0, num = self.cacheList.length; i < num; i++) {
			if (id == self.cacheList[i]) {
				return i;
			}
		}
		return -1;
	}

	// 現在のIDを取得
	Dashboard.prototype.currentId = function() {
		var self = this;
		var validIndex = 0 <= self.cacheIndex && self.cacheIndex < self.cacheList.length; // キャッシュを示すインデックスが有効か？
		var currentId = validIndex ? self.cacheList[self.cacheIndex] : 0; // 現在選択中のID
		return currentId;
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
	Dashboard.prototype.reblog = function(id, tags, comment) {
		var self = this;
		tags = tags || '';
		comment = comment || '';
		var reblogList = [];
		if (self.pinBuffer.length) {
			reblogList = self.pinBuffer;
		}
		else {
			reblogList.push({ id: id || self.currentId(), tags: tags, comment: comment });
		}
		for (var i = 0, reblogItem; reblogItem = reblogList[i]; i++) {
			var id = reblogItem['id'];
			self.reblogQueue.push({
					id: id,
					reblog_key: self.cacheData[id]['reblog_key'],
					hostname: self.blog['hostname'],
					tags: reblogItem['tags'],
					comment: reblogItem['comment'],
					retry: 0,
				});
		}
		setTimeout(function(){ self.fireEvent('reblogStart', self.reblogQueue.length); }, 1);
		//
		doReblog.call(self);
	}

	// 前のPOSTに移動
	Dashboard.prototype.prevPost = function() {
		this.foregroundTask.add(prevPostTask);
	}

	// 次のPOSTに移動
	Dashboard.prototype.nextPost = function() {
		this.foregroundTask.add(nextPostTask);
	}

	// 指定のPOSTに移動
	Dashboard.prototype.jumpPost = function(index) {
		return fetchCommand.call(this, {
					type: this.CMD_JUMP_POST,
					index: index,
				});
	}

	// 
	Dashboard.prototype.reloadCache = function(index) {
		var self = this;
		requestCachedPosts.call(self, self.currentId());
	}

	// キャッシュを読み込み
	Dashboard.prototype.loadCache = function() {
		var self = this;
		var file, data;
		var resetCache = false;

		// cacheList
		file = Ti.Filesystem.getFile(self.cacheListPath);
		data = file.read();
		if (!data || data.length <= 0) {
			data = '{}';
		}
		var cacheList = [];
		try {
			cacheList = JSON.parse(data);
		}
		catch(e) {
			resetCache = true;
lib.Log.debug('Dashboard.loadCache: #1 '+e);
		}
		self.cacheList = [];
		self.cacheData = {};
		for (var i = 0, num = cacheList.length; i < num; i++) {
			var id         = cacheList[i]['id'];
			self.cacheList.push(id);
			self.cacheData[id] = cacheList[i];
		}

		// cacheIndex
		self.cacheLastPostId = 0;
		var lastId = Ti.App.Properties.getString('lastId', 0);
		self.cacheIndex = 0;
		for (var i = 0, num = self.cacheList.length; i < num; i++) {
			var id = self.cacheList[i];
			if (lastId == id) {
				self.cacheIndex = i;
				break;
			}
		}

		// pinBuffer
		file = Ti.Filesystem.getFile(self.pinQueuePath);
		data = file.read();
		if (!data || data.length <= 0) {
			data = '{}';
		}
		var pinBuffer = [];
		try {
			pinBuffer = JSON.parse(data);
		}
		catch(e) {
			resetCache = true;
lib.Log.debug('Dashboard.loadCache: #2 '+e);
		}
		self.pinBuffer = [];
		for (var i = 0, num = pinBuffer.length; i < num; i++) {
			self.pinBuffer.push({
					id:      pinBuffer[i]['id'],
					tags:    pinBuffer[i]['tags']    || '',
					comment: pinBuffer[i]['comment'] || '',
					liked:   pinBuffer[i]['liked']   || false,
				});
		}

		if (resetCache) {
lib.Log.debug('Dashboard.loadCache: #3 detect broken cache!');
			alert('キャッシュデータに異常があったためリセットをしました');
			self.cacheLastPostId = lastId;
			self.saveCache();
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

		// pinBuffer
		file = Ti.Filesystem.getFile(self.pinQueuePath);
		file.write(JSON.stringify(self.pinBuffer));
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
		// 画像サイズ
		self.photoSize = Ti.App.Properties.getInt('photoSize', 400);
		// まとめ
		self.hideEnable = self.hideMyPosts
		               || self.hideReblogFromMyself
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
		self.imageDir = self.baseDir + '/image';
		var imageDir = Ti.Filesystem.getFile(self.imageDir);
		if (!imageDir.exists()) {
			imageDir.createDirectory();
		}
		// キャッシュ一覧の保存先
		self.cacheListPath = self.baseDir + '/dashboard.dat';
		// pin一覧の保存先
		self.pinQueuePath = self.baseDir + '/pin.dat';
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
