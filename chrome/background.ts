declare const chrome: {
  action: {
    onClicked: {
      addListener: (callback: () => void) => void;
    };
  };
  tabs: {
    create: (props: { url: string }) => void;
  };
  runtime: {
    getURL: (path: string) => string;
  };
};

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html'),
  });
});
