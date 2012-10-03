/*
 * Single Window Application Template:
 * A basic starting point for your application.  Mostly a blank canvas.
 * 
 * In app.js, we generally take care of a few things:
 * - Bootstrap the application with any data we need
 * - Check for dependencies like device type, platform version or network connection
 * - Require and open our top-level UI component
 *  
 */

//bootstrap and check dependencies
if (Ti.version < 1.8 ) {
	alert('Sorry - this application template requires Titanium Mobile SDK 1.8 or later');
}

function notify(msg) {
	if('android'==Ti.Platform.osname)Ti.UI.createNotification({message:msg}).show();
	else                             alert(msg);
}

// This is a single context application with mutliple windows in a stack
(function() {

	//determine platform and form factor and render approproate components
	var osname  = Ti.Platform.osname,
		version = Ti.Platform.version,
		height  = Ti.Platform.displayCaps.platformHeight,
		width   = Ti.Platform.displayCaps.platformWidth;

	//considering tablet to have one dimension over 900px - this is imperfect, so you should feel free to decide
	//yourself what you consider a tablet form factor for android
	var isAndroid = osname === 'android';
	var isTablet  = osname === 'ipad' || (isAndroid && (width > 899 || height > 899));

	// OAuth Consumer Key/Secret Key load
	//   key.js
	//   >exports.consumerKey    = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
	//   >exports.consumerSecret = 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy';
	//   >[EOF]
	var key = { consumerKey:'', consumerSecret:'' };
	try {
		key = require('key');
	} catch(e) {}

	var tumblr = require('tumblr').Tumblr({
			consumerKey:       key.consumerKey,
			consumerSecret:    key.consumerSecret,
			accessTokenKey:    Ti.App.Properties.getString('tumblrAccessTokenKey',    ''),
			accessTokenSecret: Ti.App.Properties.getString('tumblrAccessTokenSecret', '')
		});

	var logger = require('Logger').create('./');
	logger.setLogLevel(logger.LEVEL_NONE);

	var dashboard = require('tumblrDashboard').Dashboard(tumblr, logger);

	var intent = Ti.Android.currentActivity.getIntent();
	var intentCall = false;
	if (intent) {
//Ti.UI.createNotification({message:'intent:'+intent.getData()}).show();
		intentCall = intent.getData() ? true : false;
	}

	var tabGroup = Ti.UI.createTabGroup();

	if (intentCall) {
		var AuthWindow = require('ui/common/AuthWindow');
		var wnd = new AuthWindow(dashboard);
		wnd.open();
		return;
	}

	// メインウインドウ構築
	var Window = require('ui/common/MainWindow');
	var wnd = new Window(dashboard, logger, intentCall);

	var mainTab = Ti.UI.createTab({ window: wnd });
	wnd.containingTab = mainTab;
	tabGroup.addTab(mainTab);
	if (wnd.hideTabBar) {
		wnd.hideTabBar();
	}

	var actInd = Titanium.UI.createActivityIndicator({
		bottom:10, 
		height:50,
		width: 150
	});
	if (Ti.UI.iPhone) {
		actInd.style = Titanium.UI.iPhone.ActivityIndicatorStyle.PLAIN;
	}

	wnd.add(actInd);

	dashboard.addEventListener('beforeLogin', function() {
//			actInd.message = 'Logging in ...';
//			actInd.show();
		});

	dashboard.addEventListener('login', function(e) {
			// toast表示
			if (isAndroid) {
				Ti.UI.createNotification({
						message: e.success ? 'ログイン成功' : 'ログイン失敗'
					}).show();
			}
			//
			if (e.success) {
			}
			else {
			}
//			actInd.hide();
		});

	wnd.addEventListener('open', function(e) {
		});

	wnd.open();

})();
