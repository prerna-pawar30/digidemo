export const getISTTime = ()=>{
    return new Date().toLocaleString("en-IN",{
        timeZone:"Asia/Kolkata",
        hour12:true,
    });
};

export const getISTDateTime=()=>{
    const date = new Date().toLocaleString("en-IN",{
        timezone:"Asia/Kolkata",
        hour12:true,
    });
    return date.replace(",","");
};