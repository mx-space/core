export interface IPResponseData {
  code: number
  success: boolean
  message: string
  data: Data
  location: string
  myip: string
  time: string
}
interface Data {
  ip: string
  dec: string
  country: string
  countryCode: string
  province: string
  city: string
  districts: string
  idc: string
  isp: string
  net: string
  protocol: string
  begin: string
  end: string
}
