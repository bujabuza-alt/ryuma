var LOGO_BLACK='img/logo-black.png'; // 로고 이미지 (base64 인라인 → 파일 분리로 JS 용량 절감)
// ── 전역 상태 ──
var currentStore = null;
var _pendingStore = null;
var STORE_NAMES = {covent:'류마 코벤트', paragon:'류마 파라곤'};
var DEFAULT_PW   = {covent:'1234', paragon:'1234'};
var STORAGE_KEY  = '';

var INIT_COVENT = [
  {id:1,n:'1번',shape:'sq',sz:'m',c:4,px:2, py:5 },
  {id:2,n:'2번',shape:'sq',sz:'m',c:4,px:35,py:5 },
  {id:3,n:'3번',shape:'sq',sz:'m',c:4,px:68,py:5 },
  {id:4,n:'4번',shape:'sq',sz:'m',c:4,px:68,py:32},
  {id:5,n:'5번',shape:'sq',sz:'m',c:4,px:68,py:58},
  {id:6,n:'6번',shape:'sq',sz:'s',c:2,px:68,py:80},
  {id:7,n:'바1', shape:'bar',sz:'m',c:2,px:2, py:38},
  {id:8,n:'바2', shape:'bar',sz:'m',c:2,px:2, py:55},
  {id:9,n:'바3', shape:'bar',sz:'m',c:2,px:2, py:72}
];
var INIT_PARAGON = [
  {id:1,n:'A',  shape:'sq',  sz:'s',c:2,px:2, py:5 },
  {id:2,n:'B',  shape:'sq',  sz:'s',c:2,px:26,py:5 },
  {id:3,n:'C',  shape:'wide',sz:'m',c:4,px:52,py:5 },
  {id:4,n:'D',  shape:'sq',  sz:'m',c:4,px:2, py:30},
  {id:5,n:'E',  shape:'sq',  sz:'m',c:4,px:35,py:30},
  {id:6,n:'F',  shape:'wide',sz:'l',c:6,px:2, py:57},
  {id:7,n:'G',  shape:'sq',  sz:'m',c:4,px:68,py:30},
  {id:8,n:'바1', shape:'bar', sz:'m',c:2,px:68,py:60},
  {id:9,n:'바2', shape:'bar', sz:'m',c:2,px:68,py:76}
];

var S = {tables:[],waits:[],ress:[],tags:[],daily:[],customers:[],inventory:[],stockCats:[],stockUnits:[],images:[],imageCats:[],staffActive:[],staffResigned:[],staffLogs:[],staffRecords:[],staffFavTimes:[],staffSchedule:[],dailyMemos:{},weeklyMemos:{},mealOptions:{meal:[],soup:[],side:[]},dailyMeals:{},orderProducts:[],orderItems:[],orderHistory:[],orderInit:false};
var DEFAULT_TAGS = ['생일','기념일','데이트','VIP','단체','비즈니스'];
var currentTab='floor', editMode=false, saveTimer=null;
var calY=new Date().getFullYear(), calM=new Date().getMonth(), calSel=null;
var floorDate = '';
var rvSortAsc=true;
var gvFloor=2, gvWait=2, gvRes=2, gvRvAdd=2, gvRvEdit=2;
var activeResTableId=null;
var dragOffset={x:0,y:0}, dragPanelRect=null;
var cardCache={};
var _editShape='sq', _editSz='m';
var viewMode='canvas'; // 'canvas' | 'list'
var mergeSelectMode=false, mergeMasterId=null, mergeSelectedIds=[];

// ── Firebase ──
var fbApp = firebase.initializeApp({databaseURL:'https://ryuma-reservation-default-rtdb.firebaseio.com'});
var fbDb  = firebase.database();
var fbRef = null;
var lastSavedTs = 0;


// ── 추가 전역 변수 (원본에서 각 위치에 선언된 것을 전역으로 끌어올림) ──
var lastDate = '';
var VIVID_COLORS = ['#e63946','#f4a261','#2ec4b6','#457b9d','#e9c46a','#6a4c93','#f72585','#4cc9f0','#06d6a0','#fb8500'];
var NOTION_DB_ID = '7562318a7b0b41b5aa3a9ec91cba2d85';
