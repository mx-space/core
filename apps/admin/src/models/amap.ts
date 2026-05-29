export interface Amap {
  status: string
  regeocode: Regeocode
  info: string
  infocode: string
}

export interface Regeocode {
  addressComponent: AddressComponent
  formattedAddress: string
}

export interface AddressComponent {
  city: string
  province: string
  adcode: string
  district: string
  towncode: string
  streetNumber: StreetNumber
  country: string
  township: string
  businessAreas: BusinessArea[]
  building: Building
  neighborhood: Building
  citycode: string
}

export interface Building {
  name: any[]
  type: any[]
}

export interface BusinessArea {
  location: string
  name: string
  id: string
}

export interface StreetNumber {
  number: string
  location: string
  direction: string
  distance: string
  street: string
}

export interface AMapSearch {
  suggestion: Suggestion
  count: string
  infocode: string
  pois: Pois[]
  status: string
  info: string
}

export interface Pois {
  parent: any[] | string
  address: string
  distance: any[]
  pname: string
  importance: any[]
  bizEXT: BizEXT
  bizType: any[]
  cityname: string
  type: string
  photos: any[]
  typecode: string
  shopinfo: string
  poiweight: any[]
  childtype: any[] | string
  adname: string
  name: string
  location: string
  tel: any[]
  shopid: any[]
  id: string
}

export interface BizEXT {
  cost: any[]
  rating: any[]
}

export interface Suggestion {
  keywords: any[]
  cities: any[]
}
