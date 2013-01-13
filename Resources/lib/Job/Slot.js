//	var lib = require('lib');
//	var slot = lib.Job.createSlot({});

module.exports = (function(global){
	
	var Slot = function(params){
		var self = this;

		params = params || {};

		self.title      = undefined != params.title      ? params.title      : '';
		self.context    = undefined != params.context    ? params.context    : this;
		self.retryCount = undefined != params.retryCount ? params.retryCount : 5;
		self.withExec   = undefined != params.withExec   ? params.withExec   : true;

		self.itemList = [];
		self.slotList = [];
		self.slotRunning = 0;
		if (params.slot && params.slotNum) {
			self.setupSlot(params.slot, params.slotNum);
		}

	};

	var lib = require('lib');

	/////////////////////////////////////////
	// プロパティ
	/////////////////////////////////////////

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////

	//　処理待ち数を取得
	Slot.prototype.getItemCount = function() {
		return this.itemList.length;
	}

	// スロットの初期化
	Slot.prototype.setupSlot = function(slot, num) {
		var self = this;
		self.slotList = [];
		for (var i = 0; i < num; i++) {
			self.slotList.push({
					running: false,
					slot: slot,
				});
		}
	}

	// スロットで処理するアイテムの追加
	Slot.prototype.add = function(items) {
		var self = this;
		if (undefined != items.length) {
			for (var i = 0, item; item = items[i]; i++) {
				self.itemList.push({ params: item, retryRest: self.retryCount });
			}
		}
		else {
			self.itemList.push({ params: items, retryRest: self.retryCount });
		}
		if (self.withExec) {
			setTimeout(function(){ self.exec(); }, 1);
		}
	}

	// スロット実行時のコールバックを生成
	Slot.prototype.createCallback = function(callback) {
		var self = this;
		var currentItem = self.currentItem;
		return function(){
				if (callback.apply(self.context, arguments)) {
					// 成功
				}
				else {
					// 失敗
					currentItem.retryRest--;
					if (0 <= currentItem.retryRest) {
						self.itemList.push(currentItem);
					}
				}
				self.slotRunning--;
				if (!self.exec()) {
					self.fireEvent('complite');
				}
			};
	}

	// スロットの実行
	Slot.prototype.exec = function() {
		var self = this;
//lib.Log.debug('#1　'+self.itemList.length+','+self.slotRunning+','+self.slotList.length);
		for (; self.itemList.length &&
			self.slotRunning < self.slotList.length; ) {
//lib.Log.debug('#2　'+self.itemList.length+','+self.slotRunning+','+self.slotList.length);
			for (var i = 0, slot; slot = self.slotList[i]; i++) {
				if (!slot.running) {
					self.currentItem = self.itemList.shift();
					self.slotRunning++;
					slot.runnng = true;
					var r = slot.slot.call(self.context, self.currentItem.params);
					if (undefined != r && !r) {
						self.slotRunning--;
						slot.runnng = false;
					}
					break;
				}
			}
//lib.Log.debug('#3　'+self.itemList.length+','+self.slotRunning+','+self.slotList.length);
		}
//lib.Log.debug('#4 '+self.itemList.length+','+self.slotRunning+','+self.slotList.length);
		if (0 < self.itemList.length) {
			self.fireEvent('wakeup');
		}
		return 0 < self.itemList.length || 0 < self.slotRunning;
	}

	// イベントリスナーの登録
	Slot.prototype.addEventListener = function(eventName, callback) {
		this.listeners = this.listeners || {};
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(callback);
	};

	// イベントの発火
	Slot.prototype.fireEvent = function(eventName, data) {
		data = data || {};
		data.source = this;
		data.type   = eventName;
		this.listeners = this.listeners || {};
		var eventListeners = this.listeners[eventName] || [];
		for (var i = 0; i < eventListeners.length; i++) {
			eventListeners[i].call(this, data);
		}
	};

	// インスタンスを生成して返す	
	return Slot;
})(this);
