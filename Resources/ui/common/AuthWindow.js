//AuthWindow Component Constructor

function AuthWindow(dashboard) {
	//determine platform and form factor and render approproate components
	var osname  = Ti.Platform.osname,
		version = Ti.Platform.version,
		height  = Ti.Platform.displayCaps.platformHeight,
		width   = Ti.Platform.displayCaps.platformWidth;

	//considering tablet to have one dimension over 900px - this is imperfect, so you should feel free to decide
	//yourself what you consider a tablet form factor for android
	var isAndroid = osname === 'android';
	var isTablet  = osname === 'ipad' || (isAndroid && (width > 899 || height > 899));

	var wndOptions = {};
	if (isAndroid) {
		wndOptions['navBarHidden'] = true;
		wndOptions['exitOnClose']  = true;
	}

	var self = Ti.UI.createWindow(wndOptions);
	var view = Ti.UI.createView({ backgroundColor: '#fff' });

	// ビュー

	var preloader = Ti.UI.createLabel({
							width:  '48dp',
							height: '48dp',
							backgroundImage: '/images/like-disabled.png',
						});

	view.add(preloader);

	self.add(view);

	self.addEventListener('open', function(){
			dashboard.authorize();
		});

//	self.addEventListener('close', function(){
//			var intent = Ti.Android.createIntent({
//								action: Ti.Android.ACTION_VIEW,
//								packageName: 'net.sharkpp.Tumbdash',
//								className: 'net.sharkpp.Tumbdash.TumbdashActivity',
//							});
//			Ti.Android.currentActivity.startActivity(intent);
//		});

	dashboard.addEventListener('login', function(e) {
			self.close();
		});

//	setTimeout(function(){ self.close(); }, 5000);

	return self;
}

module.exports = AuthWindow;
