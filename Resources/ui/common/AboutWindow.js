//AboutWindow Component Constructor

function AboutWindow() {
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
	}

	var self = Ti.UI.createWindow(wndOptions);

	// ビュー

	var path = Ti.Filesystem.resourcesDirectory + 'etc/about.html';
	var file = Ti.Filesystem.getFile(path);
	var data = file.read().toString();
	data = data.replace('{app_name}',        Ti.App.name)
	           .replace('{app_version}',     Ti.App.version)
	           .replace('{app_description}', Ti.App.description)
	           .replace('{copyright}',       Ti.App.copyright);

	var view = Ti.UI.createWebView({ backgroundColor: '#fff', html: data });

	self.add(view);

	return self;
}

module.exports = AboutWindow;
