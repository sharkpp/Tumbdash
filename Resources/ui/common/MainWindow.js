//MainWindow Component Constructor

function MainWindow(dashboard) {
	//determine platform and form factor and render approproate components
	var osname  = Ti.Platform.osname,
		version = Ti.Platform.version,
		height  = Ti.Platform.displayCaps.platformHeight,
		width   = Ti.Platform.displayCaps.platformWidth;

	//considering tablet to have one dimension over 900px - this is imperfect, so you should feel free to decide
	//yourself what you consider a tablet form factor for android
	var isAndroid = osname === 'android';
	var isTablet  = osname === 'ipad' || (isAndroid && (width > 899 || height > 899));

	var lib = require('lib');

	var layout = lib.UI.createLayouter('MainWindow');

	var cacheLoaded = false;

	var pinAfterMove, savePinState;
	var tagsForReblog = '';

	var updateProperties = function() {
		// Pin指定後の動作
		pinAfterMove = parseInt(Ti.App.Properties.getString('pinAfterMove', '-1'));
		pinAfterMove = -1 == pinAfterMove || 0 == pinAfterMove || 1 == pinAfterMove ? pinAfterMove : -1;
		Ti.App.Properties.setString('pinAfterMove', '' + pinAfterMove);
		// Pinの状態を保存する
		savePinState = Ti.App.Properties.getBool('savePinState', false);
		// タグ
		tagsForReblog = Ti.App.Properties.getString('tagsForReblog', '');
		tagsForReblog = tagsForReblog.split(/[\n\r]/);
		for(var i = tagsForReblog.length - 1; 0 <= i; i--) {
			if (!tagsForReblog[i].length) {
				tagsForReblog.splice(i, 1);
			}
		}
		// 基準ディレクトリ
		var baseDirPath = Ti.App.Properties.getString('baseDir', '');
		    baseDirPath = baseDirPath ? 'file://' + baseDirPath.replace(/^file:\/\//, '') : '';
		var baseDir     = baseDirPath ? Ti.Filesystem.getFile(baseDirPath) : false;
		if (!baseDirPath || !baseDir.exists()) {
			if (Ti.Filesystem.isExternalStoragePresent()) {
				var externalStorageDirectory = Ti.Filesystem.getFile(Ti.Filesystem.externalStorageDirectory);
				baseDirPath = externalStorageDirectory.getParent().nativePath + '/' + Ti.App.name
				externalStorageDirectory.deleteDirectory();
			}
			else {
				baseDirPath = Ti.Filesystem.applicationDataDirectory;
			}
		}
		baseDir = Ti.Filesystem.getFile(baseDirPath);
		if (!baseDir.exists()) {
			baseDir.createDirectory();
		}
		Ti.App.Properties.setString('baseDir', baseDir.nativePath.replace(/^file:\/\//, ''));
		// デバッグモード
		var debugMode = Ti.App.Properties.getBool('debugMode', false);
		debugConsole.visible = debugMode;
		// ログレベル指定
		lib.Log.setLogDir(baseDir.nativePath);
		lib.Log.setLogLevel(debugMode ? lib.Log.LEVEL_DEBUG : lib.Log.LEVEL_NONE);
//lib.Log.setLogLevel(lib.Log.LEVEL_NONE);
lib.Log.debug(JSON.stringify(tagsForReblog));
	}

	var checkAuthorized = function() {
		// アカウント認証
		var authorized = Ti.App.Properties.getBool('authorized', false);
		if (!authorized) {
			var authQ = Titanium.UI.createAlertDialog({
					title: 'アカウント認証',
					message: 'アカウント認証を行いますか？',
					buttonNames: ['はい','いいえ'],
					cancel: 1
				});
			authQ.addEventListener('click', function(e){
					if (0 == e.index) { // OK
						dashboard.authorize();
					}
				});
			authQ.show();
		}
	}

	var setLabelText = function(label, text) {
		label.text = text;
		label.width = String.format("%ddp", 16 + 8 * text.length)
	}

	var updateConsole = function() {
		if (debugConsole.visible) {
			var state = dashboard.getState();
			debugConsole.value
				= String.format(
					"foreground:%s\n" +
					"background:%s\n" +
					"network:%s(%s)\n" +
					"cache total:%d\n" +
					"cache pos:%d\n" +
					"active cache:%d(%d-%d)\n" +
					"pin:%d\n" +
					"ID:%s %s",
					state.foreground,
					state.background,
					state.network,
					state.networkSlot,
					dashboard.totalPost(),
					dashboard.currentPost(),
					dashboard.activeCacheCount(),
					dashboard.activeCacheTop(),
					dashboard.activeCacheLast(),
					dashboard.totalPin(),
					''+dashboard.currentId(),
					dashboard.pinState() ? '(pinned)' : ''
					);
		}
	}

	var createToolbarButton = function(parameters) {
		parameters = parameters || {};
		var params = {}, innerParams = {};
		for (key in parameters) {
			params[key] = parameters[key];
		}
		var keys = {
				'backgroundImage':         { move: true },
				'backgroundDisabledImage': { move: true },
				'backgroundSelectedImage': { move: true },
				'enabled':                 {},
			};
		for (key in keys) {
			if (params[key]) {
				innerParams[key] = params[key];
			}
			if (keys[key]['move']) {
				delete params[key];
			}
		}
		var button      = Ti.UI.createView(params);
		var buttonInner = Ti.UI.createLabel(innerParams);
		layout.addItem('toolbar-button-inner', buttonInner);
		button.add(buttonInner);
		buttonInner.addEventListener('touchstart', function(e) {
				button.backgroundColor = button.backgroundSelectedColor;
			});
		buttonInner.addEventListener('touchend', function(e) {
				button.backgroundColor = '#0000';
			});
		return button;
	}

	var enableToolbarButton = function(button, enabled) {
		button.enabled = enabled;
		for (var i = 0, child; child = button.children[i]; i++) {
			child.enabled = enabled;
		}
	}

	var showJumpDialog = function(e) {
		var JumpDialog = require('ui/common/JumpDialog');
		var dlg = new JumpDialog({
				cached: dashboard.getCachedPostId(),
				id: dashboard.currentId(),
			});
		dlg.addEventListener('click', function(e){
lib.Log.debug(''+e.position);
				jumpPostid = e.id;
				if (0 < e.id) {
					var index = dashboard.findPost(e.id);
					dashboard.jumpPost(index);
				}
			});
		dlg.show();
	}

	var path = Ti.Filesystem.resourcesDirectory + 'etc/loader.html';
	var file = Ti.Filesystem.getFile(path);
	var loaderHtml = file.read().toString();

	//

	var posts = require('tumblrPost').tumblrPost();

	var eventBlock = false;

	//create object instance, a parasitic subclass of Observable

	var wndOptions = {};
	if (isAndroid) {
		wndOptions['navBarHidden'] = true;
		wndOptions['exitOnClose']  = true;
	}

	var self = lib.UI.createWindow(wndOptions);
	var view = Ti.UI.createView();

	// 各UIを初期化

	// ビュー

	var webview = Ti.UI.createWebView();
	webview.html = dashboard.authorized() ? loaderHtml : '';
	layout.addItem('webview', webview);
	view.add(webview);

	var status = Ti.UI.createLabel({
							visible: false,
							touchEnabled: false,
						});
	layout.addItem('status', status);
	view.add(status);

	var pinStatus = Ti.UI.createLabel({
							visible: false,
							backgroundImage: '/images/pin.png',
						});
	layout.addItem('pin-status', pinStatus);
	view.add(pinStatus);

	var debugConsole = Ti.UI.createTextArea({
							visible: false,
							touchEnabled: false,
							editable: false,
						});
	layout.addItem('console', debugConsole);
	debugConsole.visible = true;
	debugConsole.addEventListener('click', function() {
			debugConsole.visible = false;
			setTimeout(function(){ debugConsole.visible = true; }, 10000);
		});
	view.add(debugConsole);

	// ツールバー

	var toolbar = Ti.UI.createView();
	layout.addItem('toolbar', toolbar);

	var likeButton = createToolbarButton({
							enabled: false,
							backgroundImage:         '/images/like.png',
							backgroundDisabledImage: '/images/like-disabled.png',
							backgroundSelectedImage: '/images/like-selected.png',
						});
	layout.addItem('toolbar-like-button', likeButton);
	likeButton.addEventListener('click', function() {
			if (dashboard.like()) {
			}
		});
	toolbar.add(likeButton);

	var reblogButton = createToolbarButton({
							enabled: false,
							backgroundImage:         '/images/reblog.png',
							backgroundDisabledImage: '/images/reblog-disabled.png',
							backgroundSelectedImage: '/images/reblog-selected.png',
						});
	layout.addItem('toolbar-reblog-button', reblogButton);
	reblogButton.addEventListener('click', function() {
			if (!tagsForReblog.length || dashboard.totalPin()) {
				// タグが指定されてなかったりPinが指定されていなかったらそのまま実行
				dashboard.reblog();
			}
			else {
				var PinDialog = require('ui/common/PinDialog');
				var dlg = new PinDialog({
						disableLike: true,
					});
				dlg.addEventListener('click', function(e){
						if (e.index != e.source.cancel) {
							dashboard.reblog(dashboard.currentId(), e.tags.join(','), e.comment);
						}
					});
				dlg.show();
			}
		});
	toolbar.add(reblogButton);

	var prevButton = createToolbarButton({
							enabled: false,
							backgroundImage:         '/images/prev.png',
							backgroundDisabledImage: '/images/prev-disabled.png',
							backgroundSelectedImage: '/images/prev-selected.png',
						});
	layout.addItem('toolbar-prev-button', prevButton);
	prevButton.addEventListener('click', function() {
			if (eventBlock) { // longpress判定後のイベント通知をキャンセル
				eventBlock = false;
				return;
			}
			if (dashboard.prevPost()) {
				enableToolbarButton(prevButton, false);
				enableToolbarButton(nextButton, false);
			}
			// デバッグ
			updateConsole();
		});
	prevButton.addEventListener('longpress', function(e) { eventBlock = true; showJumpDialog(); });
	toolbar.add(prevButton);

	var nextButton = createToolbarButton({
							enabled: false,
							backgroundImage:         '/images/next.png',
							backgroundDisabledImage: '/images/next-disabled.png',
							backgroundSelectedImage: '/images/next-selected.png',
						});
	layout.addItem('toolbar-next-button', nextButton);
	nextButton.addEventListener('click', function() {
			if (eventBlock) { // longpress判定後のイベント通知をキャンセル
				eventBlock = false;
				return;
			}
			if (dashboard.nextPost()) {
				enableToolbarButton(prevButton, false);
				enableToolbarButton(nextButton, false);
			}
			// デバッグ
			updateConsole();
		});
	nextButton.addEventListener('longpress', function(e) { eventBlock = true; showJumpDialog(); });
	toolbar.add(nextButton);

	var pinButton = createToolbarButton({
//							enabled: false,
							backgroundImage:         '/images/pin.png',
							backgroundDisabledImage: '/images/pin-disabled.png',
							backgroundSelectedImage: '/images/pin-selected.png',
						});
	layout.addItem('toolbar-pin-button', pinButton);
	pinButton.addEventListener('click', function() {
			if (!tagsForReblog.length || dashboard.pinState()) {
				// タグが指定されてなかったりPinの解除をしようとしていたらそのまま実行
				dashboard.pin();
			}
			else {
				var PinDialog = require('ui/common/PinDialog');
				var dlg = new PinDialog({
						disableLike: true,
					});
				dlg.addEventListener('click', function(e){
						if (e.index != e.source.cancel) {
							dashboard.pin(dashboard.currentId(), e.tags.join(','), e.comment, e.liked);
						}
					});
				dlg.show();
			}
		});
	toolbar.add(pinButton);

	var badge = Ti.UI.createLabel({
							visible: false
						});
	layout.addItem('toolbar-pin-badge', badge);
	badge.addEventListener('click', function() {
			pinButton.fireEvent('click');
		});
	toolbar.add(badge);

	enableToolbarButton(likeButton,   false);
	enableToolbarButton(reblogButton, false);
	enableToolbarButton(prevButton,   false);
	enableToolbarButton(nextButton,   false);
//	enableToolbarButton(pinButton,    false);

	view.add(toolbar);

	self.add(view);

	// メニュー

	var openedPreferences = false;
	var jumpPostid = 0;

	if (isAndroid) {
		self.addEventListener('open', function(){
				var activity = self.activity; // openの後でないと取得できない
				activity.addEventListener('resume', function() {
lib.Log.debug('resume');
						dashboard.loadCache();
						dashboard.reloadCache();
					});
				activity.addEventListener('pause', function() {
lib.Log.debug('pause');
						dashboard.saveCache();
					});
				var pinClearId = 1;
				activity.addEventListener('menucreate', function(e) {
						var menu = e.menu; // save off menu.
//Ti.UI.createNotification({message:'create menu'}).show();
						var menuPinClear = menu.add({ title : 'Pinのクリア', itemId: pinClearId });
						menuPinClear.setIcon(Ti.Android.R.drawable.ic_menu_delete);
						menuPinClear.addEventListener('click', function(e) {
								var dlg = Ti.UI.createAlertDialog({
										cancel: 1,
										message: 'Pinをクリアしますか？',
										buttonNames: ['はい', 'いいえ'],
										title: 'Pinのクリア'
									});
								dlg.addEventListener('click', function(e){
										if (e.index !== e.source.cancel){
											dashboard.pinClear();
											dashboard.fireEvent('updatePin');
										}
									});
								dlg.show();
							});

						var menuAbout = menu.add({ title : '移動' });
						menuAbout.setIcon(Ti.Android.R.drawable.ic_menu_set_as);
						menuAbout.addEventListener('click', showJumpDialog);

						var menuOption = menu.add({ title : '設定' });
						menuOption.setIcon(Ti.Android.R.drawable.ic_menu_preferences);
						menuOption.addEventListener('click', function(e) {
								openedPreferences = true;
								Ti.UI.Android.openPreferences();
							});

//						var menuReset = menu.add({ title : 'リセット' });
//						menuReset.addEventListener('click', function(e) {
//								dashboard.clearCache();
//							});

						var menuAbout = menu.add({ title : '情報' });
						menuAbout.setIcon(Ti.Android.R.drawable.ic_menu_info_details);
						menuAbout.addEventListener('click', function(e) {
								var AboutWindow = require('ui/common/AboutWindow');
								var w = new AboutWindow()
								self.containingTab.open(w, { animated:true });
							});
					});
				activity.addEventListener('menuprepare', function(e) {
						var menu = e.menu; // save off menu.
						var menuPinClear = menu.findItem(pinClearId);
						if (menuPinClear) {						
							menuPinClear.setEnabled( 0 < dashboard.totalPin() );
						}
					});
			});
	}

	// プログレスバー
	var progress;
	if (isAndroid) {
		progress = Titanium.UI.createActivityIndicator({
							location:Titanium.UI.ActivityIndicator.DIALOG,
							type:Titanium.UI.ActivityIndicator.DETERMINANT,
							message:'',
							min: 0,
							max: 1,
							value:0
						});
	}

	// 各種通知

	self.addEventListener('open', function(){
			updateProperties();
			checkAuthorized();
			dashboard.loadCache();
			dashboard.login();
		});

	self.addEventListener('close', function(){
lib.Log.debug('close');
			if (!savePinState) {
				dashboard.pinClear();
			}
		});

	self.addEventListener('focus', function(){
			if (isAndroid) {
				if (openedPreferences) {
					openedPreferences = false;
					updateProperties();
					dashboard.updateProperties();
					posts.updateProperties();
					checkAuthorized();
				}
			}
		});

	dashboard.addEventListener('login', function(e) {
			if (e.success) {
				Ti.App.Properties.setBool('authorized', true);
			}
			dashboard.fireEvent('updatePin');
			// デバッグ
			updateConsole();
		});

	dashboard.addEventListener('updatePin', function(id) {
			var pinNum = dashboard.totalPin();
			if (pinNum < 1) {
				badge.visible = false;
			}
			else {
				setLabelText(badge, String.format("%d", pinNum));
				badge.visible = true;
			}
			var pinMarkVisible = false;
			// PINがセットされたら設定により進める
			if (id && dashboard.pinState(id)) {
				var movePost = false;
				if (-1 == pinAfterMove) {
					movePost = dashboard.prevPost();
				}
				else if(1 == pinAfterMove) {
					movePost = dashboard.nextPost();
				}
				else {
					pinMarkVisible = true;
				}
				if (movePost) {
					enableToolbarButton(prevButton, false);
					enableToolbarButton(nextButton, false);
				}
			}
			pinStatus.visible = pinMarkVisible;
		});

	dashboard.addEventListener('readPost', function(data) {
			var readCount = data['readCount'] || 0;
			var continued = data['continued'] || false;
			if (0 <= readCount) {
				setLabelText(status, String.format("%d/%d",dashboard.currentPost(),dashboard.totalPost()));
				status.visible = true;
				// toast表示
				if (isAndroid) {
					if (readCount) {
						Ti.UI.createNotification({
								message: String.format("%d件のポストを取得",readCount)
							}).show();
					}
					if (!continued) {
						Ti.UI.createNotification({
								message: '取得完了'
							}).show();
					}
				}
			}
			else { // 読み取り失敗
				// toast表示
				if (isAndroid) {
					Ti.UI.createNotification({
							message: String.format("ポストの取得失敗",readCount)
						}).show();
				}
			}
			// デバッグ
			updateConsole();
		});

	dashboard.addEventListener('loading', function(id) {
			webview.html = loaderHtml;
			setLabelText(status, String.format("%d/%d",dashboard.currentPost(),dashboard.totalPost()));
			status.visible = true;
			pinStatus.visible = dashboard.pinState(id);
			// キャッシュが読み込まれたら(最初のポストが表示されたら)
			// 各ボタンを有効にする
			if (!cacheLoaded) {
				cacheLoaded = true;
		//		enableToolbarButton(likeButton,   true);
				enableToolbarButton(reblogButton, true);
				enableToolbarButton(pinButton,    true);
			}
			enableToolbarButton(prevButton, true);
			enableToolbarButton(nextButton, true);
			// デバッグ
			updateConsole();
		});

	dashboard.addEventListener('loadComplite', function(post) {
			var id = post['id'];
			posts.renderPost(webview, post);
			setLabelText(status, String.format("%d/%d",dashboard.currentPost(),dashboard.totalPost()));
			status.visible = true;
			pinStatus.visible = dashboard.pinState(id);
			// キャッシュが読み込まれたら(最初のポストが表示されたら)
			// 各ボタンを有効にする
			if (!cacheLoaded) {
				cacheLoaded = true;
		//		enableToolbarButton(likeButton,   true);
				enableToolbarButton(reblogButton, true);
				enableToolbarButton(pinButton,    true);
			}
			enableToolbarButton(prevButton, true);
			enableToolbarButton(nextButton, true);
			// デバッグ
			updateConsole();
		});

	dashboard.addEventListener('reblogStart', function(reblogNum) {
			if (isAndroid) {
				progress.message = 'リブログ中 ...';
				progress.min = 0;
				progress.max = reblogNum;
				progress.value = 0;
				progress.show();
			}
		});

	dashboard.addEventListener('reblog', function(id) {
			if (isAndroid) {
				progress.value++;
				if (progress.value == progress.max) {
					setTimeout(function(){ progress.hide() }, 250);
					dashboard.saveCache();
				}
			}
		});

	dashboard.addEventListener('debug', function() {
			// デバッグ
			updateConsole();
		});

	Ti.App.addEventListener("linkclick", function(e) {
			if (0 < e.url.length) {
				if (isAndroid) {
					var intent = Ti.Android.createIntent({
							action: Ti.Android.ACTION_VIEW,
						//	className: 'com.android.browser.BrowserActivity',
						//	packageName: 'com.android.browser',
						//	data: e.url
							data: e.url
						});
					Ti.Android.currentActivity.startActivity(intent);
				}
				else {
					Ti.Platform.openURL(e.url);
				}
			}
		});

	return self;
}

module.exports = MainWindow;
