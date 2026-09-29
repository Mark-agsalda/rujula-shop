package com.rujula.shop
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
data class Product(val id:Int,val name:String,val category:String,val price:Double,val description:String,val image_url:String,val stock:Int)
interface Api { @GET("api/products") suspend fun products(@Query("q") q:String=""):List<Product> }
object ApiClient { val service:Api by lazy { Retrofit.Builder().baseUrl(ApiConfig.BASE_URL).addConverterFactory(GsonConverterFactory.create()).build().create(Api::class.java) } }
