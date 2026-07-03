import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const getDeviceId = async () => {
    const cookies = document.cookie.split("; ");
    const existing = cookies.find((row) => row.startsWith("deviceId="));
    if (existing) {
        return existing.split("=")[1];
    }
    
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const visitorId = result.visitorId;
    
    // Set cookie to expire in 10 years (effectively permanent like localStorage)
    const d = new Date();
    d.setTime(d.getTime() + (10 * 365 * 24 * 60 * 60 * 1000));
    document.cookie = `deviceId=${visitorId}; expires=${d.toUTCString()}; path=/`;
    
    return visitorId;
};